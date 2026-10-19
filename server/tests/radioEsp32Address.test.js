import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validLanIpv4 } from '../src/lib/radioEsp32Address.js';

test('accept valid private ESP32 LAN IPs', () => {
  for (const ip of ['10.0.1.58', '192.168.1.50', '172.16.0.2', '172.31.255.254']) {
    assert.equal(validLanIpv4(ip), true, ip);
  }
});
test('reject malformed and public addresses', () => {
  for (const ip of ['8.8.8.8', '172.32.0.1', '10.0.01.58', '256.1.1.1', '10.0.1', '10.0.a.58', '', null]) {
    assert.equal(validLanIpv4(ip), false, String(ip));
  }
});
