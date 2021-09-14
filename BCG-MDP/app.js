#!/usr/bin/nodejs
Config = require('./config').Config;
Shared = Config.Shared;
Codec = Config.Devices.Codec;
Lightware = Config.Devices.Lightware;


let RoomList = {};
try {
	RoomList = require('./roomlist.json');
} catch(err) {
	console.log(`  == > !!! RoomList ERROR: roomlist.json cannot be loaded.`,err);
}

lw3client = require('./lw3client');
const RoomQuerier =  require('./roomquerier');
roomquerier = new RoomQuerier(RoomList);
const jsxapi = require('jsxapi');

var wsconnecttimeout=null;

Shared.ExternalSourceList.map( (item) => item.switch = function() {
	console.log(`  == > UserInterface Presentation ExternalSource Selected SourceIdentifier: "${item.SourceIdentifier}"`);	
	dev.lw3.CALL(`/V1/MEDIA/VIDEO/XP:switch`, `I${item.Input}:O${Lightware.Output}`, () => {});
	console.log(`  == > CALL /V1/MEDIA/VIDEO/XP:switch(I${item.Input}:O${Lightware.Output})`);
	
	/* use when USB switch required paralelly with video switch */
	//dev.lw3.CALL(`/V1/MEDIA/USB/XP:switch`, `U${item.Input}:H1`, () => {});
});

/*
function updateCodecExternalSourceState(item) {
	if (Codec.isConnected) {
		Codec.xAPI.command('UserInterface Presentation ExternalSource State Set', {SourceIdentifier:item.SourceIdentifier, State:item.State}).then( response => {
			if(response.status=='OK') {	console.log(`  == > SourceIdentifier:"${item.SourceIdentifier}" is ${item.State}`);	}
			else { console.log(`  == > Respond in not OK for SourceIdentifier:"${item.SourceIdentifier}" status update`); }
		});
	} else {console.log(`  == > Codec is not connected SourceIdentifier:"${item.SourceIdentifier}" will not be updated.`);}	
}

function registerExternalSources(item, index) {
	if (Codec.isConnected) {
		Codec.xAPI.command('UserInterface Presentation ExternalSource Add', {ConnectorId:Codec.ConnectorId, Name:item.Name, SourceIdentifier:item.SourceIdentifier, Type:item.Type}).then( response => {
			if(response.status=='OK') { console.log(`  == > ${item.Name} added to the Share screen elements with SourceIdentifier:"${item.SourceIdentifier}"`); }
			else { console.log(`  == > Respond in not OK for SourceIdentifier:"${item.SourceIdentifier}" addition`); }
		});
	}
	updateCodecExternalSourceState(item);
}
function registerSignalPresent(item, index) {
	dev.lw3.addPropertyeWatcher(`/V1/MEDIA/VIDEO/I${item.Input}`, "SignalPresent", (val) => {
		console.log(`  == > /V1/MEDIA/VIDEO/I${item.Input}.SignalPresent=${val}`);
		item.State = ((/true|1/).test(val) == true) ? "Ready" : "NotReady";
		updateCodecExternalSourceState(item);
	});
	console.log(`  == > LW3 property watcher registred for ${item.Name} for IN${item.Input}`);
}
*/

function updateCodecUSBConnected(item, connection) {
	if (Codec.isConnected) {
		if (connection) {
			Codec.xAPI.command('Message Send', { Text: item.Name + ' USB plugged in' }).then(response => {
				if (response.status == 'OK') { console.log(`  == > Message to Codec: Message Send Text: "${item.Name + ' USB plugged in'}" is`); }
				else { console.log(`  == > Message not sent to Codec:"${item.Name + ' USB plugged in'}"`); }
			});
		} else {
			Codec.xAPI.command('Message Send', { Text: item.Name + ' USB unplugged' }).then(response => {
				if (response.status == 'OK') { console.log(`  == > Message to Codec: Message Send Text: "${item.Name + ' USB unplugged'}" is`); }
				else { console.log(`  == > Message not sent to Codec:"${item.Name + ' USB unplugged'}"`); }
			});
        }
	} else {console.log(`  == > Codec is not connected, message not sent to Codec:"${item.Name + " USB plugged in"}"`);}	
}


function registerUSBConnectionWatchers(item, index) {
	dev.lw3.addPropertyeWatcher(`/V1/MEDIA/USB/U${item.Input}`, "Connected", (val) => {
		console.log(`  == > /V1/MEDIA/VIDEO/U${item.Input}.Connected=${val}`);
		//item.State = ((/true|1/).test(val)==true) ? "Ready":"NotReady";

		var connection = (/true|1/).test(val);
		updateCodecUSBConnected(item, connection);

	});
	console.log(`  == > LW3 property watcher registred for ${item.Name} for IN${item.Input}`);
}


const dev = lw3client.Noodle({'log': false});
Codec.Room = undefined;
function initRoom(ip) {
	Codec.Room = roomquerier.findRoomByDevice(Lightware.ID, ip);
	if(Codec.Room == undefined) {
		console.log(`  == > !!! No room found in the room list for my IP address or host name: `,ip); 
		return;
	}
	console.log(`  == > Room found in the room list for my IP address or host name: `,Codec.Room); 
	
	Codec.IPAddress = Codec.Room.get(Codec.ID);
	console.log('Codec.IPAddress',Codec.IPAddress);
	if(Codec.IPAddress == undefined) {
		console.log(`  == > !!! No codec ip address found in the room list for `,Codec.ID); 
		return;
	}
	console.log(`  == > Codec ip address found in the room list for `,Codec.IPAddress);
	
	jsxapi
	.connect("wss://"+Codec.IPAddress, {
		username: Codec.UserName,
		password: Codec.Password,
	})
	.on('close', (err) => {errorCodec(err);})
	.on('error', (err) => {errorCodec(err);})
	.on('ready', (xapi) => {
		Codec.xAPI = xapi;
		xapi.backend.isReady.then( (xapi) => {
			readyCodec(xapi);
		})
		.catch((reason) => {
			console.log('isReady catched: ',reason);
		});
	});
}

/* Register to input signal changes */
//Shared.ExternalSourceList.forEach(registerSignalPresent);
Shared.ExternalSourceList.forEach(registerUSBConnectionWatchers);
dev.lw3.addPropertyeWatcher(`/V1/MANAGEMENT/UID`, "HwVersion", (val) => { Lightware.HwVersion = val; });
dev.lw3.addPropertyeWatcher(`/`, "PackageVersion", (val) => { Lightware.PackageVersion = val; });
dev.lw3.addPropertyeWatcher(`/`, "ProductName", (val) => { Lightware.ProductName = val; });
dev.lw3.addPropertyeWatcher(`/V1/MANAGEMENT/NETWORK`, "IpAddress", (val) => { Lightware.IpAddress = val; if(!Codec.Room) initRoom(val); });
dev.lw3.addPropertyeWatcher(`/V1/MANAGEMENT/NETWORK`, "HostName", (val) => { Lightware.HostName = val; if(!Codec.Room) initRoom(val); if(!Codec.Room) initRoom(`${val}.local`); });
dev.lw3.addPropertyeWatcher(`/`, "SerialNumber", (val) => { Lightware.SerialNumber = val; });
	

function readyCodec() {
	console.log('  == > Cisco Codec conenction ready');
	
	Codec.isConnected = true;
	  
	/*Codec.xAPI.config.get('Video Input Connector').then( response => {
		/* set ut the used connector 
		response.filter( connector => connector.id == Codec.ConnectorId).map( c => {
			Codec.xAPI.config.set(`Video Input Connector ${c.id} Name`,'Source');
			Codec.xAPI.config.set(`Video Input Connector ${c.id} Visibility`,'Always');
			if (c.InputSourceType != 'camera') {
				Codec.xAPI.config.set(`Video Input Connector ${c.id} PresentationSelection`,'Manual');
				Codec.xAPI.config.set(`Video Input Connector ${c.id} CameraControl Mode`,'Off');
			}
		});
		/* setup the unused connector 
		response.filter( connector => connector.id != Codec.ConnectorId).map( c => {
			Codec.xAPI.config.set(`Video Input Connector ${c.id} Name`,'');
			Codec.xAPI.config.set(`Video Input Connector ${c.id} Visibility`,'Never');
		});
	});/*	
	
	/* Control system and heartbeat handling */
	Codec.xAPI.config.set(`Peripherals Profile ControlSystems`,1).then( result => {
		console.log(`  == > Peripherals Profile ControlSystems 1 resulted ${result.status}`);
	});
	Codec.xAPI.command(`Peripherals Connect`,
		{
			ID: 'Lightware',
			Name:`Lightware ${Lightware.ProductName}`,
			Type:'ControlSystem',
			SerialNumber:Lightware.SerialNumber,
			NetworkAddress:Lightware.IpAddress,
			HardwareInfo:Lightware.HwVersion,
			SoftwareInfo:Lightware.PackageVersion
		}).then( result => {
		console.log(`  == > Lightware Taurus registered as ControlSystem resulted ${result.status}`);
	});
	Codec.xAPI.command(`Peripherals HeartBeat`,{ID: 'Lightware', Timeout:10}).then( result => {
		console.log(`  == > HeartBeat update ${result.status}`);
	});
	Shared.HeartBeat = setInterval(
		function(){
			Codec.xAPI.command(`Peripherals HeartBeat`,{ID: 'Lightware', Timeout:10}).then( result => {
				console.log(`  == > HeartBeat update ${result.status}`);
			});
		},
		10*60*10
	);
	

	/* Remove all the external sources from the Share screen */
	/*console.log('  == > UserInterface Presentation ExternalSource RemoveAll');
	Codec.xAPI.command('UserInterface Presentation ExternalSource RemoveAll').then( response => {
		if(response.status=='OK') {	console.log(`  == > Removing all ExternalSources from the Share screen succeeded`);	}
		else { console.log(`  == > Respond in not OK for ExternalSources removal`);	}
	});*/

	/* Register the configured sources to the codec, and update the signal info */
	//Shared.ExternalSourceList.forEach(registerExternalSources);

	/* Switch source when selected */
	/*Codec.xAPI.event.on('UserInterface Presentation ExternalSource Selected SourceIdentifier', (selectedsourceid) => {
		Shared.ExternalSourceList.find( (item) => item.SourceIdentifier == selectedsourceid ).switch();
	});*/

	Codec.xAPI.event.on('PresentationStopped',		(event) => { Shared.PresentationStopped(event, dev); });
	Codec.xAPI.event.on('PresentationPreviewStopped',	(event) => { Shared.PresentationStopped(event, dev); });
	Codec.xAPI.event.on('PresentationStarted',		(event) => { Shared.PresentationStarted(event, dev); });
	Codec.xAPI.event.on('PresentationPreviewStarted',	(event) => { Shared.PresentationStarted(event, dev); });
	
	Codec.xAPI.event.on('OutgoingCallIndication',		(event) => { Shared.CallStarted(event, dev); });
	Codec.xAPI.event.on('IncomingCallIndication',		(event) => { Shared.CallStarted(event, dev); });
	Codec.xAPI.event.on('CallDisconnect',				(event) => { Shared.CallEnded(event, dev); });
	
//	Codec.xAPI.command(`UserInterface Message Prompt Display`,{Title: `Lightware ${Lightware.ProductName} integration to ${Codec.Room.roomID}`, Text:'Your system is ready to use', Duration:5});
	Codec.xAPI.command(`UserInterface Message Prompt Display`,{Text: `Room ${Codec.Room.roomID}<br>integrated with<br>Lightware ${Lightware.ProductName}`, Title:'Your system is ready to use', Duration:10});
	Codec.xAPI.command(`Presentation Stop`,{}).then( response => {
		Shared.PresentationStopped(null, dev);
	});

	//var WebcamSources = ["Laptop USB-C","Laptop HDMI","Room PC",""];
	var WebcamSources = [];


	for(var i = 1; i <= 4; i++){
		WebcamSources[i-1] = "";

		Shared.ExternalSourceList.forEach((item) => {
			if(i == parseInt(item.Input, 10)){
				WebcamSources[i-1] = item.Name;
			}
		});
	}

	Shared.ExternalSourceList.forEach( (item) => {
		WebcamSources.push(item.Name);
	});
	
	var PreviousSelectedCameraPreset = 0;
	var ExitWebcamMode =
	`
	<Extensions>
	<Version>1.6</Version>
	<Panel>
		<PanelId>lw_exit_webcammode_panel</PanelId>
		<Type>Statusbar</Type>
		<Icon>Camera</Icon>
		<Order>4</Order>
		<Color>#FF7033</Color>
		<Name>Exit Webcam Mode</Name>
		<ActivityType>Custom</ActivityType>
	</Panel>
	</Extensions>
	`
	var StartWebcamMode =
	`
	<Extensions>
	<Version>1.6</Version>
	<Panel>
		<PanelId>lw_start_webcammode_panel</PanelId>
		<Type>Statusbar</Type>
		<Icon>Camera</Icon>
		<Order>4</Order>
		<Color>#00FF00</Color>
		<Name>Start Webcam Mode</Name>
		<ActivityType>Custom</ActivityType>
	</Panel>
	</Extensions>
	`
	var currentSource = ''; //Start webcam panel
	Codec.xAPI.event.on('UserInterface Extensions Panel Clicked', (event) => {
		if (event.PanelId == 'lw_exit_webcammode_panel') {
			Codec.xAPI.command('Camera Preset Activate', { PresetId: '10' });
			Codec.xAPI.command('UserInterface Extensions Panel Save', { PanelId: 'lw_start_webcammode_panel' }, StartWebcamMode);
		} else if (event.PanelId == 'lw_start_webcammode_panel') {
			for (var cam in WebcamSources) {
				if (WebcamSource[cam] == currentSource) {
					Codec.xAPI.command('Message Send', { Text: (10 + parseInt(cam) + 1) + ' sent from button as preset' });
					Codec.xAPI.command('Camera Preset Activate', { PresetId: (10 + parseInt(cam) + 1) });
                }
            }
			//Codec.xAPI.command('Message Send', { Text: (10 + parseInt(currentSource) + 1) + ' sent from button as preset' });
			//Codec.xAPI.command('Camera Preset Activate', { PresetId: (10 + parseInt(currentSource) + 1) });
        }
	});

	Codec.xAPI.command('Camera Preset Store', {Name: 'Webex', PresetId:10, CameraId:1});
	for (var cam=0; cam<4; cam++) {
	if (WebcamSources[cam] != '') {
		Codec.xAPI.command('Camera Preset Store', {Name: WebcamSources[cam], PresetId:(10+parseInt(cam)+1).toString(), CameraId:1});
	}
	else {
		Codec.xAPI.command('Camera Preset Remove', {PresetId:(10+parseInt(cam)+1).toString()}).catch(err => console.log(err));
	}
	}

	Codec.xAPI.event.on('UserInterface Message Prompt Response', (event) => {
		for (var cam in WebcamSources) {
			if (event.FeedbackId == 'SwitchWebcam'+WebcamSources[cam]) {
				if (event.OptionId == '1') {
					Codec.xAPI.command('Camera Preset Activate', {PresetId: '1'+(parseInt(cam)+1)});
				}
			}
		}
	});

	Codec.xAPI.event.on('Message Send', (event) => {
	for (var cam in WebcamSources) {
		if (event.Text == WebcamSources[cam] + ' USB plugged in') {
			currentSource = WebcamSources[cam];
			Codec.xAPI.command('Message Send', { Text: currentSource + ' is stored' });
			Codec.xAPI.command('UserInterface Extensions Panel Save', { PanelId: 'lw_start_webcammode_panel' }, StartWebcamMode);
			Codec.xAPI.command('UserInterface Message Prompt Display', {
				Title: WebcamSources[cam] + ' USB plugged in',
				Text: 'Do you want to switch webcam to ' + WebcamSources[cam] + '',
				'Option.1': 'Yes',
				'Option.2': 'No',
				FeedbackId: 'SwitchWebcam' + WebcamSources[cam]
			});
		} else if (event.Text == WebcamSources[cam] + ' USB unplugged') {
			Codec.xAPI.command('UserInterface Extensions Panel Remove', { PanelId: 'lw_start_webcammode_panel' });
			Codec.xAPI.command('UserInterface Extensions Panel Remove', { PanelId: 'lw_exit_webcammode_panel' });
        }
	}
	});

	Codec.xAPI.event.on('CameraPresetActivated', (event) => {
	if ((event.PresetId == 10) && (PreviousSelectedCameraPreset != 10)) {
		dev.lw3.CALL(`/V1/MEDIA/USB/XP:switch`, `0:H1`, () => {});
		dev.lw3.SET(`/V1/MEDIA/USB/H1/D1.Power5VMode`, `Off`, () => {});

		Codec.xAPI.command('Presentation Stop');
		Codec.xAPI.command('UserInterface Extensions Panel Remove', { PanelId: 'lw_exit_webcammode_panel' });
	}
	if (event.PresetId > 10) {
		let input = event.PresetId % 10;
		dev.lw3.CALL(`/V1/MEDIA/VIDEO/XP:switch`, `I${input}:O${Lightware.Output}`, () => {});
		dev.lw3.CALL(`/V1/MEDIA/USB/XP:switch`, `U${input}:H1`, () => {});
		dev.lw3.SET(`/V1/MEDIA/USB/H1/D1.Power5VMode`, `On`, () => {});

		Codec.xAPI.command('Presentation Start');
		Codec.xAPI.command('UserInterface Extensions Panel Save', { PanelId: 'lw_exit_webcammode_panel' }, ExitWebcamMode);
		Codec.xAPI.command('UserInterface Extensions Panel Remove', { PanelId: 'lw_start_webcammode_panel' });
	}
	PreviousSelectedCameraPreset = event.PresetId;
	});

	// logic for calls coming in. Same logic for "exit webcam mode"
	Codec.xAPI.event.on('CallSuccessful', (_event) => {
		dev.lw3.CALL(`/V1/MEDIA/USB/XP:switch`, `0:H1`, () => { });
		dev.lw3.SET(`/V1/MEDIA/USB/H1/D1.Power5VMode`, `Off`, () => { });

		//Codec.xAPI.command('Presentation Stop');
		Codec.xAPI.command('UserInterface Extensions Panel Remove', { PanelId: 'lw_exit_webcammode_panel' });
	});
}


function errorCodec(err) {
	Codec.isConnected = false;
	console.log('  == > Cisco Codec conenction issue with:',err);
	
	clearInterval(Shared.HeartBeat);
	try {
		if (Codec.xAPI !== null) {
			Codec.xAPI.close();
			Codec.xAPI=null;
		}
	} catch (err) {
		console.log('Err ==> Codec.xAPI.close();',err);
	} finally {
		Codec.xAPI = null;
		clearTimeout(wsconnecttimeout);
		wsconnecttimeout = setTimeout( function()
			{
				jsxapi.connect("wss://"+Codec.IPAddress, {
					username: Codec.UserName,
					password: Codec.Password,
				})
				.on('close', (err) => {errorCodec(err);})
				.on('error', (err) => {errorCodec(err);})
				.on('ready', (xapi) => {
					Codec.xAPI = xapi;
					xapi.backend.isReady.then( (xapi) => {
						readyCodec();
					})
					.catch((reason) => {
						console.log('isReady catched: ',reason);
					});
				});
			},
			1000
		);
	}
}