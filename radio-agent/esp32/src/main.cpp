#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <esp_system.h>
#include <Update.h>
#include <mbedtls/sha256.h>
#include <mbedtls/md.h>
#include "secrets.h"

// Active HIGH relay at GPIO13. Requires verified external pull-down/driver and
// electrician-checked mains isolation; firmware alone is not an electrical interlock.
constexpr uint8_t RELAY_GPIO=13;
constexpr uint32_t HEARTBEAT_TIMEOUT_MS=10000;
constexpr uint32_t POWER_LEASE_MAX_MS=9000;
WebServer server(80);
String lastMode="DISCONNECTED";
String bootNonce;
uint32_t lastHeartbeat=0,heartbeatCount=0,powerExpires=0,lastSequence=0,lastHeartbeatSequence=0;
bool commandedOn=false;
uint32_t lastWifiReconnect=0;
uint32_t restartAt=0;
bool otaAuthorized=false,otaCompleted=false;
String otaExpectedDigest;
mbedtls_sha256_context otaDigest;


void powerOff(){
  digitalWrite(RELAY_GPIO,LOW);
  commandedOn=false;
  powerExpires=0;
}
void respond(int code,const String& body){
  server.sendHeader("Cache-Control","no-store");
  server.send(code,"application/json; charset=utf-8",body);
}
bool authorized(){
  const String supplied=server.header("X-Radio-Local-Secret");
  return strlen(RADIO_PAIR_SECRET)>=32 && supplied.length()>=32 &&
         supplied==String(RADIO_PAIR_SECRET);
}
bool heartbeatFresh(){return lastHeartbeat!=0 && millis()-lastHeartbeat<HEARTBEAT_TIMEOUT_MS;}
bool powerLeaseValid(){return commandedOn && powerExpires!=0 && (int32_t)(powerExpires-millis())>0;}
String hmacHex(const String& payload) {
  unsigned char result[32];
  auto md=mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  mbedtls_md_hmac(md,(const unsigned char*)RADIO_PAIR_SECRET,strlen(RADIO_PAIR_SECRET),
                  (const unsigned char*)payload.c_str(),payload.length(),result);
  const char hex[]="0123456789abcdef";
  String out;out.reserve(64);
  for(uint8_t i=0;i<32;i++){out+=hex[result[i]>>4];out+=hex[result[i]&15];}
  return out;
}
bool equalDigest(const String& a,const String& b) {
  if(a.length()!=64||b.length()!=64)return false;
  uint8_t diff=0;
  for(size_t i=0;i<64;i++)diff|=uint8_t(a[i]^b[i]);
  return diff==0;
}
void status(){
  JsonDocument doc;
  doc["device"]="MEDIA_RAF_RAW_ESP32";
  doc["mode"]="POWER_CONTROL_V1";
  doc["relayGpio"]=RELAY_GPIO;
  doc["relayActiveLevel"]="HIGH";
  doc["relayOutputEnabled"]=true;
  doc["amplifierPower"]=commandedOn?"ON_COMMANDED":"OFF_COMMANDED";
  doc["wifiConnected"]=WiFi.status()==WL_CONNECTED;
  doc["agentMode"]=lastMode;
  doc["heartbeatFresh"]=heartbeatFresh();
  doc["leaseValid"]=powerLeaseValid();
  doc["heartbeatCount"]=heartbeatCount;
  doc["powerSequence"]=lastSequence;
  doc["heartbeatSequence"]=lastHeartbeatSequence;
  doc["bootNonce"]=bootNonce;
  String out;serializeJson(doc,out);respond(200,out);
}
void heartbeat(){
  JsonDocument req;
  if(deserializeJson(req,server.arg("plain"))){respond(400,R"({"error":"INVALID_JSON"})");return;}
  const char* mode=req["mode"]|"";
  if(strcmp(mode,"CENTRAL")!=0 && strcmp(mode,"LOCAL_RESERVE")!=0 && strcmp(mode,"STOPPED")!=0){
    respond(400,R"({"error":"INVALID_MODE"})");return;
  }
  const uint32_t seq=req["seq"]|uint32_t(0);
  const bool ready=req["audioReady"]|false, allowed=req["authorizedByPlatform"]|false;
  const String payload=bootNonce+":hb:"+String(seq)+":"+String(mode)+":"+(ready?"1":"0")+":"+(allowed?"1":"0");
  if(seq==0 || seq<=lastHeartbeatSequence ||
     !equalDigest(server.header("X-Radio-Signature"),hmacHex(payload))){
    respond(403,R"({"error":"INVALID_SIGNATURE_OR_REPLAY"})");return;
  }
  lastHeartbeatSequence=seq;
  lastMode=mode;
  lastHeartbeat=millis();
  heartbeatCount++;
  respond(202,R"({"ok":true,"relayOutputEnabled":true})");
}
void powerRequest(){
  JsonDocument req;
  if(deserializeJson(req,server.arg("plain"))){respond(400,"{\"error\":\"INVALID_JSON\"}");return;}
  const uint32_t sequence=req["seq"]|uint32_t(0);
  const uint32_t lease=req["leaseMs"]|uint32_t(0);
  const bool permit=req["permit"]|false;
  const String signature=server.header("X-Radio-Signature");
  const String payload=bootNonce+":"+String(sequence)+":"+(permit?"1":"0")+":"+String(lease);
  if(strlen(RADIO_PAIR_SECRET)<32 || sequence==0 || sequence<=lastSequence ||
     !equalDigest(signature,hmacHex(payload))){
    respond(403,"{\"error\":\"INVALID_SIGNATURE_OR_REPLAY\"}");return;
  }
  lastSequence=sequence;
  if(!permit){
    powerOff();
    respond(200,"{\"ok\":true,\"amplifierPower\":\"OFF_COMMANDED\"}");return;
  }
  if(lease==0 || lease>POWER_LEASE_MAX_MS || !heartbeatFresh() || WiFi.status()!=WL_CONNECTED) {
    powerOff();
    respond(409,"{\"error\":\"INTERLOCK_NOT_READY\"}");return;
  }
  digitalWrite(RELAY_GPIO,HIGH);
  commandedOn=true;
  powerExpires=millis()+lease;
  respond(200,"{\"ok\":true,\"amplifierPower\":\"ON_COMMANDED\"}");
}
void restartRequest(){
  JsonDocument req;
  if(deserializeJson(req,server.arg("plain"))){respond(400,R"({"error":"INVALID_JSON"})");return;}
  const uint32_t seq=req["seq"]|uint32_t(0);
  const String payload=bootNonce+":restart:"+String(seq);
  if(strlen(RADIO_PAIR_SECRET)<32 || seq==0 || seq<=lastSequence ||
     !equalDigest(server.header("X-Radio-Signature"),hmacHex(payload))){
    respond(403,R"({"error":"INVALID_SIGNATURE_OR_REPLAY"})");return;
  }
  lastSequence=seq;
  powerOff(); // Always drop relay before a remote maintenance reboot.
  restartAt=millis()+500;
  respond(202,R"({"ok":true,"restarting":true})");
}
// Signed local OTA: only a device-paired operator may upload an image, and
// its SHA-256 is verified BEFORE activating the new partition. Never power
// the amplifier during a firmware change.
void firmwareUpload(){
  HTTPUpload& upload=server.upload();
  if(upload.status==UPLOAD_FILE_START){
    otaAuthorized=false;otaCompleted=false;
    const uint32_t seq=server.header("X-Radio-OTA-Seq").toInt();
    const String digest=server.header("X-Radio-OTA-SHA256");
    const String payload=bootNonce+":flash:"+String(seq)+":"+digest;
    if(strlen(RADIO_PAIR_SECRET)<32 || seq==0 || seq<=lastSequence ||
       digest.length()!=64 || !equalDigest(server.header("X-Radio-Signature"),hmacHex(payload))){
      return;
    }
    for(size_t i=0;i<64;i++)if(!isxdigit(digest[i]))return;
    lastSequence=seq;
    powerOff();
    otaExpectedDigest=digest;
    mbedtls_sha256_init(&otaDigest);
    mbedtls_sha256_starts(&otaDigest,0);
    otaAuthorized=Update.begin(UPDATE_SIZE_UNKNOWN,U_FLASH);
    if(!otaAuthorized)mbedtls_sha256_free(&otaDigest);
  }else if(upload.status==UPLOAD_FILE_WRITE){
    if(!otaAuthorized)return;
    mbedtls_sha256_update(&otaDigest,upload.buf,upload.currentSize);
    if(Update.write(upload.buf,upload.currentSize)!=upload.currentSize){
      Update.abort();
      mbedtls_sha256_free(&otaDigest);
      otaAuthorized=false;
    }
  }else if(upload.status==UPLOAD_FILE_END){
    if(!otaAuthorized)return;
    unsigned char digest[32];
    mbedtls_sha256_finish(&otaDigest,digest);
    mbedtls_sha256_free(&otaDigest);
    String got;
    const char digits[]="0123456789abcdef";
    for(uint8_t i=0;i<32;i++){got+=digits[digest[i]>>4];got+=digits[digest[i]&15];}
    if(got!=otaExpectedDigest){Update.abort();otaAuthorized=false;return;}
    otaCompleted=Update.end(true);
    otaAuthorized=false;
  }else if(upload.status==UPLOAD_FILE_ABORTED){
    if(otaAuthorized){Update.abort();mbedtls_sha256_free(&otaDigest);}
    otaAuthorized=false;
  }
}
void firmwareResult(){
  powerOff();
  if(!otaCompleted){respond(400,R"({"error":"INVALID_FIRMWARE_OR_SIGNATURE"})");return;}
  restartAt=millis()+800;
  respond(202,R"({"ok":true,"updating":true})");
}
void setup(){
  // OFF before configuring as output; a physical pulldown is required at boot.
  digitalWrite(RELAY_GPIO,LOW);
  pinMode(RELAY_GPIO,OUTPUT);
  powerOff();
  Serial.begin(115200);
  char buf[17];
  snprintf(buf,sizeof(buf),"%08lx%08lx",(unsigned long)esp_random(),(unsigned long)esp_random());
  bootNonce=String(buf);
  WiFi.mode(WIFI_STA);
  // A relay controller needs low-latency LAN heartbeats/lease renewals.
  // Disable modem-sleep to avoid Wi-Fi power-save wakeup delays on the studio AP.
  // This changes radio latency only; safety interlocks remain unchanged.
  WiFi.setSleep(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(RADIO_WIFI_SSID,RADIO_WIFI_PASSWORD);
  const char* headers[]={"X-Radio-Local-Secret","X-Radio-Signature","X-Radio-OTA-Seq","X-Radio-OTA-SHA256"};
  server.collectHeaders(headers,4);
  server.on("/health",HTTP_GET,status);
  server.on("/heartbeat",HTTP_POST,heartbeat);
  server.on("/power",HTTP_POST,powerRequest);
  server.on("/restart",HTTP_POST,restartRequest);
  server.on("/firmware",HTTP_POST,firmwareResult,firmwareUpload);
  server.onNotFound([](){respond(404,"{\"error\":\"NOT_FOUND\"}");});
  server.begin();
}
void loop(){
  server.handleClient();
  if(restartAt && (int32_t)(millis()-restartAt)>=0){powerOff();ESP.restart();}
  // Recover stalled studio Wi-Fi after router/internet outages without a
  // physical power cycle. A reconnection is never authority to energize GPIO.
  if(WiFi.status()!=WL_CONNECTED && millis()-lastWifiReconnect>=15000){
    lastWifiReconnect=millis();
    powerOff();
    WiFi.disconnect();
    WiFi.begin(RADIO_WIFI_SSID,RADIO_WIFI_PASSWORD);
  }
  if(WiFi.status()!=WL_CONNECTED || !heartbeatFresh() || !powerLeaseValid()) {
    if(commandedOn)powerOff();
  }
  if(lastHeartbeat && !heartbeatFresh()){lastMode="DISCONNECTED";}
  delay(2);
}
