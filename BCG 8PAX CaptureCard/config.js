exports.Config = {
	Devices:{
		Codec:{
			ID:'CiscoCodec',
			UserName:"LightwareTaurus",
			Password:"Cust0mUs3rScr1pt",
			xAPI:null,
			isConnected:false,
			ConnectorId:2
		},
		Lightware:{
			ID:"Taurus",
			Output:1,
			PackageVersion:'',
			ProductName:'',
			HwVersion:'',
			IpAddress:'',
			SerialNumber:'',

		}
	},
	Shared:{
		ExternalSourceList : [
			{SourceIdentifier:"taur-in-1", Name:"USB-C (1)",	Type:"PC", State:"NotReady", Input:1},
			{SourceIdentifier:"taur-in-2", Name:"USB-C (2)",	Type:"PC", State:"NotReady", Input:2},
			{SourceIdentifier:"taur-in-3", Name:"HDMI (3)",	Type:"PC", State:"NotReady", Input:3},
			{SourceIdentifier:"taur-in-4", Name:"HDMI (4)",	Type:"PC", State:"NotReady", Input:4}
		],
		HeartBeat:null,
		PresentationStopped:function(event, client) {
			//client.lw3.CALL(`/V1/MEDIA/USB/XP:switch`, `U2:H1`, () => {});	
		},
		PresentationStarted:function(event, client) {},
		CallStarted:function(event, client) {},
		CallEnded:function(event, client) {}
	}
};


