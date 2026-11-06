"""Accept a fresh explicit server intent for real main-station missile PCM.

No local test button, no guessed event, no bypass of operator hardware arming,
emergency OFF, or exact registered ESP32 controller binding.
"""
def authorized_mchs_station_power(intent, *, esp32_ip, hardware_armed, isolated=False):
    return (
        hardware_armed is True
        and not isolated
        and isinstance(intent, dict)
        and intent.get('permit') is True
        and intent.get('policyMode') == 'MCHS'
        and intent.get('reason') == 'Основное оповещение МЧС'
        and intent.get('emergencyOff') is False
        and intent.get('hardwareExpected') == 'POWER_CONTROL_V1'
        and intent.get('esp32Ip') == esp32_ip
        and isinstance(intent.get('mchsEventId'), str)
        and 0 < len(intent['mchsEventId']) <= 128
    )
