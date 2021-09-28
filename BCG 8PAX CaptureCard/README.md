# Userscript for ECMWF BonnOffice project, Lightware UK

A node.js project for Cisco Webex Room Kit integration with Taurus UCX

# Steps for integration:
- Create the following user with pass in the codecs (let us know if they want to change it and we will update your pack):
  - USERNAME / PASSWORD
    - LightwareTaurus
    - Cust0mUs3rScr1pt
  - privileges should be enabled for RoomControl, Integrator, Admin
  - this should be disabled: Require passphrase change on next user sign in
- Websocket has to be enabled in the codec (the integration works with wss (secured websocket) communication)
  - Open the codec web interface
  - Settings -> Configurations -> NetworkServices -> Websocket -> FollowHTTPService
  - Settings -> Configurations -> NetworkServices -> HTTP -> Mode -> HTTPS
  - Save the settings