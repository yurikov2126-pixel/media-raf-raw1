#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <esp_system.h>
#include "secrets.h"

// SAFE PILOT ONLY. GPIO13 is held INPUT (high impedance) and NO relay commands
// are ever executed. A 5V relay input may activate on either HIGH or LOW;
// electrical polarity and physical isolation must be verified separately.
constexpr int RELAY_GPIO = 13;
constexpr uint32_t HEARTBEAT_TIMEOUT_MS = 10000;
constexpr uint32_t MAX_LEASE_MS = 30000;
WebServer server(80);
String lastMode="DISCONNECTED";
uint32_t lastHeartbeat=0;
uint32_t leaseUntil=0;
uint32_t heartbeatCount=0;

void respond(int code, const String& body) {
  server.sendHeader("Cache-Control", "no-store");
  server.send(code, "application/json; charset=utf-8", body);
}
bool authorized() {
  const String supplied=server.header("X-Radio-Local-Secret");
  return strlen(RADIO_PAIR_SECRET)>=32 && supplied.length()>=32 &&
    supplied==String(RADIO_PAIR_SECRET);
}
void status() {
  JsonDocument doc;
  doc["device"]="MEDIA_RAF_RAW_ESP32";
  doc["mode"]="SAFE_PILOT";
  doc["relayGpio"]=RELAY_GPIO;
  doc["relayOutputEnabled"]=false;
  doc["amplifierPower"]="UNCONTROLLED";
  doc["wifiConnected"]=WiFi.status()==WL_CONNECTED;
  doc["agentMode"]=lastMode;
  doc["heartbeatFresh"]=lastHeartbeat!=0 && millis()-lastHeartbeat<HEARTBEAT_TIMEOUT_MS;
  doc["leaseValid"]=leaseUntil!=0 && (int32_t)(leaseUntil-millis())>0;
  doc["heartbeatCount"]=heartbeatCount;
  String out;serializeJson(doc,out);respond(200,out);
}
void heartbeat(){
  if(!authorized()) {respond(403,"{\"error\":\"UNAUTHORIZED\"}");return;}
  if(!server.hasArg("plain")) {respond(400,"{\"error\":\"INVALID_BODY\"}");return;}
  JsonDocument req;
  if(deserializeJson(req,server.arg("plain"))) {respond(400,"{\"error\":\"INVALID_JSON\"}");return;}
  const char* mode=req["mode"]|"";
  const bool audioReady=req["audioReady"]|false;
  const bool authorizedByPlatform=req["authorizedByPlatform"]|false;
  uint32_t requested=req["leaseMs"]|0;
  if(strcmp(mode,"CENTRAL")!=0 && strcmp(mode,"LOCAL_RESERVE")!=0 && strcmp(mode,"STOPPED")!=0){
    respond(400,"{\"error\":\"INVALID_MODE\"}");return;
  }
  lastMode=mode;
  lastHeartbeat=millis();
  heartbeatCount++;
  if(audioReady && authorizedByPlatform && strcmp(mode,"STOPPED")!=0 && requested>0){
    leaseUntil=millis()+min(requested,MAX_LEASE_MS);
  } else leaseUntil=0;
  // Lease is visibility-only in this phase; it cannot energize an amplifier.
  respond(202,"{\"ok\":true,\"relayOutputEnabled\":false}");
}
void setup(){
  pinMode(RELAY_GPIO,INPUT); // never issue HIGH/LOW without verified relay polarity
  Serial.begin(115200);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(RADIO_WIFI_SSID,RADIO_WIFI_PASSWORD);
  server.collectHeaders(new const char*[1]{"X-Radio-Local-Secret"},1);
  server.on("/health",HTTP_GET,status);
  server.on("/heartbeat",HTTP_POST,heartbeat);
  server.onNotFound([](){respond(404,"{\"error\":\"NOT_FOUND\"}");});
  server.begin();
}
void loop(){
  server.handleClient();
  if(lastHeartbeat && millis()-lastHeartbeat>=HEARTBEAT_TIMEOUT_MS){
    lastMode="DISCONNECTED";leaseUntil=0;
  }
  delay(2);
}
