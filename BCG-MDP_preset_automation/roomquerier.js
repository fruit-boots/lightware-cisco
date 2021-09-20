class Room {
	constructor(roomID, roomConfig) {
		this.config=roomConfig;
		this.roomID = roomID;
	}
	get(deviceID) {
		return this.config[deviceID];
	}
};

module.exports = class RoomQuerier {
	constructor(roomList) {
		this.roomList=roomList;
	}
	findRoomByDevice(DeviceID, ip) {
		for(let [roomIDiterator, roomConfig] of Object.entries(this.roomList)) {
			if(roomConfig[DeviceID] == ip) {
				return new Room(roomIDiterator, roomConfig);
			}
		}
		return undefined;
	}
	findRoomById(RoomID) {
		for(let [roomIDiterator, roomConfig] of Object.entries(this.roomList)) {
			if(roomIDiterator == RoomID) {
				return new Room(roomIDiterator, roomConfig);
			}
		}
		return undefined;
	}
};