'use strict';

let http = require('http');
let express = require('express');
let socketio = require('socket.io');

let app = express();
let server = http.createServer(app)
let io = socketio(server)


io.on('connection', onConnection);

app.use(express.static('public'));
server.listen(3000, function(){
    console.log("Ready on port: 3000")  
})




/**/
function User(nick, sock, id){
    this.nick = nick;
    this.sock = sock;
    this.id = id;
    this.sock.nick = nick;
    console.log("Registered: " + this.nick + " o id: " + this.id)
}

User.register = function(nick, sock){
    if(!User.registered[nick]){
        User.numberOfAll++;
        User.registered[nick] = new User(nick, sock, User.numberOfAll);
        
        return true;
    }else{
        return false
    }
}

User.registered = {};
User.unregister = {};
User.numberOfAll = 0;




/* Room */
function Room(name, maxMembers, allowedPassword, password){
    this.name = name;
    this.maxMembers =  maxMembers;
    this.password = allowedPassword && password ? password : false;
    this.members = [];
    this.messages = [];
}

Room.all = {}
Room.numberOfAll = 0;

Room.create = function(name,maxMembers, allowedPassword, password){
    if(!Room.all[name]){
        Room.all[name] = new Room(name, maxMembers, allowedPassword, password);
        Room.numberOfAll++
    }
}

Room.prototype.addUser = function(user, password){    
    if(user.room){
        var oldRoom = Room.all[user.room];
        Room.all[user.room].removeUser(user);
    }
    
    user.room = this.name;
    this.members.push(user);
    Send.toUser(user.nick, "messagesFromRoom", this.packMessages());
    
    if(oldRoom){
        Send.toRegistered("updateRoomData", [Room.packRoom(oldRoom), Room.packRoom(Room.all[this.name])]);  
    }else{
        Send.toRegistered("updateRoomData", [Room.packRoom(Room.all[this.name])]);  
 
    }
}

Room.prototype.removeUser = function(userToRemove){
    var roomMembers = this.members;
    roomMembers.splice(roomMembers.indexOf(userToRemove), 1);
    userToRemove.room = false;
}

Room.prototype.addMessage = function(message){
    this.messages.push(message);
}

Room.prototype.getNicksAllMembers = function(){
    var nicksAllMembers = [];
    this.members.forEach(function(member){
        nicksAllMembers.push(member.nick);
    })
    return nicksAllMembers
}

Room.prototype.packMessages = function(){
    return this.messages.slice(-10, this.messages.length);
}

Room.prototype.userCanJoin = function(user, password){
    if(this.members.length >= this.maxMembers){
        return false;
    }
    if(this.password){
        if(this.password == password){
            return true;
        }else{
            return false;
        }
    }
    return true;
}

Room.packRoom = function(room){
    return {
            name: room.name,
            maxMembers: room.maxMembers,
            members: room.getNicksAllMembers(),
            password: room.password ? true : false,
            lastMessage: room.password ? false : room.messages[room.messages.length-1]
            }
}

Room.packAllRoomsForUser = function(){
    var packedRoom = [];
    for(var i in Room.all){
        packedRoom.push(Room.packRoom(Room.all[i]))
    }
    return packedRoom;
}




/* Message */
function Message(content, author, date){
    this.content = content;
    this.author = author;
    this.date = date;
}




/* Actions */
Room.create("Pokoj 1", 3, false);
Room.create("Pokoj 2", 5, true, "admin");
Room.create("Pokoj 3", 10, false);




var Send = {
    toUser: function(userNick, nameOfEmit, message){
        User.registered[userNick].sock.emit(nameOfEmit, message);
    },
    
    toRoom: function(roomName, nameOfEmit, message){
        Room.all[roomName].members.forEach(function(member){
            member.sock.emit(nameOfEmit, message);
        });
    },
    
    toRegistered: function( nameOfEmit, message){
        for(var i in User.registered){
            User.registered[i].sock.emit(nameOfEmit, message);
        }
    }
}




/**/
function onConnection(sock){    
    sock.on('join', function(sockData){
        
    })
    
    sock.on('disconnect', function(){
        var user = User.registered[sock.nick];
        console.log("User: " + sock.nick + " opuścił serwer!");
        
        if(user){
            if(user.room){
                var oldRoom = Room.all[user.room]
                Room.all[user.room].removeUser(user);
                Send.toRegistered("updateRoomData", [Room.packRoom(oldRoom)]);
            }

            delete User.registered[sock.nick];
                       
        }
    })
    
    sock.on('nick', function(nick){
        if(User.register(nick, sock)){
            Send.toUser(nick, "nick", nick);
            Send.toUser(nick,"updateRoomData", Room.packAllRoomsForUser())
        }else{
            sock.emit("nick", false);
        }
    });
    
    sock.on('roomAddUser', function(roomName, userName, password){
        var user = User.registered[userName];
        var room = Room.all[roomName]
        if(room.userCanJoin(user, password)){
            Send.toUser(sock.nick, 'roomAddUser', roomName)
            room.addUser(user);
            console.log("Użytkownik: " + userName + " dołączył do pokoju: " + roomName);
        }else if(room.members.length >= room.maxMembers){
            Send.toUser(sock.nick, "info", "W pokoju jest maksymalna liczba użytkowników!")
        }else{
            Send.toUser(sock.nick, "info", "Błędne hasło!")
        }
    })
    
    sock.on('chat-message', function(message){
        Room.all[message.room].addMessage(message);
        Send.toRegistered("updateRoomData", [Room.packRoom(Room.all[message.room])]);
        Send.toRoom(message.room, "chat-message", message);
    })
}