#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <esp_system.h>
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
  doc["bootNonce"]=bootNonce;
  String out;serializeJson(doc,out);respond(200,out);
}
void heartbeat(){
  JsonDocument req;
  if(deserializeJson(req,server.arg("plain"))){respond(400,"{\\"error\\":\\"INVALID_JSON\\"}");return;}
  const char* mode=req["mode"]|"";
  if(strcmp(mode,"CENTRAL")!=0 && strcmp(mode,"LOCAL_RESERVE")!=0 && strcmp(mode,"STOPPED")!=0){
    respond(400,"{\\"error\\":\\"INVALID_MODE\\"}");return;
  }
  const uint32_t seq=req["seq"]|uint32_t(0);
  const bool ready=req["audioReady"]|false, allowed=req["authorizedByPlatform"]|false;
  const String payload=bootNonce+":hb:"+String(seq)+":"+String(mode)+":"+(ready?"1":"0")+":"+(allowed?"1":"0");
  if(seq==0 || seq<=lastHeartbeatSequence ||
     !equalDigest(server.header("X-Radio-Signature"),hmacHex(payload))){
    respond(403,"{\\"error\\":\\"INVALID_SIGNATURE_OR_REPLAY\\"}");return;
  }
  lastHeartbeatSequence=seq;
  lastMode=mode;
  lastHeartbeat=millis();
  heartbeatCount++;
  respond(202,"{\\"ok\\":true,\\"relayOutputEnabled\\":true}");
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
  WiFi.setAutoReconnect(true);
  WiFi.begin(RADIO_WIFI_SSID,RADIO_WIFI_PASSWORD);
  const char* headers[]={"X-Radio-Local-Secret","X-Radio-Signature"};
  server.collectHeaders(headers,2);
  server.on("/health",HTTP_GET,status);
  server.on("/heartbeat",HTTP_POST,heartbeat);
  server.on("/power",HTTP_POST,powerRequest);
  server.onNotFound([](){respond(404,"{\"error\":\"NOT_FOUND\"}");});
  server.begin();
}
void loop(){
  server.handleClient();
  if(WiFi.status()!=WL_CONNECTED || !heartbeatFresh() || !powerLeaseValid()) {
    if(commandedOn)powerOff();
  }
  if(lastHeartbeat && !heartbeatFresh()){lastMode="DISCONNECTED";}
  delay(2);
}
