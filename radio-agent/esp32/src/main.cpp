#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>

// MEDIA RAF RAW ESP32 pilot. GPIO13 is intentionally NEVER driven.
// Keep the mains-rated relay module disconnected from the amplifier.
constexpr uint8_t RELAY_PIN = 13;
constexpr uint32_t HEARTBEAT_TTL_MS = 12000;
constexpr uint32_t MAX_LEASE_MS = 60000;
WebServer server(80);
Preferences prefs;
String agentKey;
uint32_t lastHeartbeat = 0;
uint32_t leaseUntil = 0;
bool agentReady = false;
bool internetHealthy = false;
bool reserveActive = false;
bool wifiProvisioned = false;

bool authorized() {
  String token = server.header("X-Radio-Agent-Key");
  // Pilot LAN token is only for telemetry, never grants GPIO access.
  if (agentKey.length() < 32 || token.length() != agentKey.length()) return false;
  uint8_t diff = 0;
  for (size_t i = 0; i < token.length(); i++) diff |= token[i] ^ agentKey[i];
  return diff == 0;
}

void status() {
  uint32_t now = millis();
  bool alive = lastHeartbeat && (uint32_t)(now - lastHeartbeat) < HEARTBEAT_TTL_MS;
  String json = "{\"device\":\"media-raf-raw-esp32\",\"mode\":\"SAFE_MONITOR\",";
  json += "\"relayPin\":13,\"relayPowerEnabled\":false,";
  json += "\"agentConnected\":" + String(alive ? "true":"false") + ",";
  json += "\"agentReady\":" + String(alive && agentReady ? "true":"false") + ",";
  json += "\"localReserve\":" + String(alive && reserveActive ? "true":"false") + ",";
  json += "\"serverConnected\":" + String(alive && internetHealthy ? "true":"false") + "}";
  server.sendHeader("Cache-Control", "no-store");
  server.send(200, "application/json", json);
}

void heartbeat() {
  if (!authorized()) { server.send(403, "text/plain", "Forbidden"); return; }
  if (!server.hasArg("plain")) { server.send(400, "text/plain", "Missing JSON"); return; }
  String body = server.arg("plain");
  // Strict bounded protocol; no requests can switch the 230V relay.
  if (body.length() > 300 || !body.startsWith("{") || !body.endsWith("}")) {
    server.send(400, "text/plain", "Invalid payload"); return;
  }
  agentReady = body.indexOf("\"ready\":true") >= 0;
  reserveActive = body.indexOf("\"reserve\":true") >= 0;
  internetHealthy = body.indexOf("\"server\":true") >= 0;
  lastHeartbeat = millis();
  status();
}

void setup() {
  // GPIO13 remains INPUT (high impedance). No coil activation by firmware.
  pinMode(RELAY_PIN, INPUT);
  Serial.begin(115200);
  prefs.begin("radio", true);
  String ssid = prefs.getString("ssid", "");
  String password = prefs.getString("pass", "");
  agentKey = prefs.getString("key", "");
  prefs.end();
  if (ssid.isEmpty() || agentKey.length() < 32) {
    Serial.println("SAFE_MONITOR: configure WiFi and 32+ character LAN key over serial provisioning.");
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid.c_str(), password.c_str());
  wifiProvisioned = true;
  const char* headerNames[] = {"X-Radio-Agent-Key"};
  server.collectHeaders(headerNames, 1);
  server.on("/status", HTTP_GET, status);
  server.on("/heartbeat", HTTP_POST, heartbeat);
  server.onNotFound([](){ server.send(404, "text/plain", "Not found"); });
  server.begin();
}

void loop() {
  if (!wifiProvisioned) { delay(1000); return; }
  server.handleClient();
  if(lastHeartbeat && (uint32_t)(millis()-lastHeartbeat) > HEARTBEAT_TTL_MS) {
    agentReady = false; reserveActive = false; internetHealthy = false; lastHeartbeat = 0;
  }
  delay(2);
}
