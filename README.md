# lightware-cisco

Add codec credentials to config file then zip dir to upload.

**BCG-MDP_original**
- original file sent by lightware

**BCG-MDP_call_connected**
- disable USB ports on lightware when call is connected

**BCG-MDP_preset_automation**
- disable USB ports when call is connected
- logic to resume webcam mode via button on touch panel by monitoring last USB connection

**BCG-MDP_t10_prompt_with_function**
- disable USB ports when call is connected
- logic to resume webcam mode via button on touch panel
- removes core logic of using presets on codec to route sources/USB

**BCG-MDP_current**

**This is the latest version.** Settings on the codec should be `OnStreaming` for BYOD mode and `OnConnect` for content sharing.
This allows the automation to work properly.
- disable USB ports when call is connected, resume USB ports when call is disconnected.
- automate USB connection via last connected source, meaning there is no prompt on the touch panel and no exit/start webcam mode buttons.
