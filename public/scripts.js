var user = io();
user.login = function(){
    //this.emit("nick", prompt("Jak masz na imię?"));
    this.emit("nick", autologin.login());
}

var autologin = {
    users:1,
    login: function(){
        return "User " + this.users++
    },
}





/**/
function Room(name, members, maxMembers, password, lastMessage){
    this.name = name;
    this.members = members;
    this.maxMembers =  maxMembers;
    this.password = password;
    this.messages = [];
    this.lastMessage = lastMessage;
}
Room.prototype.addUser = function(user, password){
    if(this.password){
        user.emit("roomAddUser", this.name, user.nick, password);
    }else{
        user.emit("roomAddUser", this.name, user.nick);
    }
}

Room.all = {}

Room.addRoom = function(item){
    Room.all[item.name] = new Room(item.name, item.members, item.maxMembers, item.password, item.lastMessage);
}

Room.prototype.addMessage = function(message){
    this.messages.push(message);
    
    var scrollInBottom = WindowChat.scrollInBottom()
    
    WindowChat.createMessage(message);
    WindowChat.updateRoomCard(Room.all[message.room]);
    
    if(scrollInBottom){
        WindowChat.setScrollInBottom()
    }
}

Room.prototype.updateData = function(data){
    this.name = data.name || this.name;
    this.maxMembers = data.maxMembers || this.maxMembers;
    this.members = data.members || this.members;
    this.password = data.password || this.password;
    this.lastMessage = data.lastMessage || this.lastMessage;
    
    WindowChat.updateRoomCard(this);
}





/**/
function Message(content, author, room){
    this.content = content;
    this.author = author;
    this.room = room;
    this.date = new Date();
    this.id = Message.getId(room);
}
    
Message.getId = function(room){
    var room = Room.all[room];
    
    if(room.messages.length <= 0){
        return 1;
    }else{
        return room.messages.length+1;
    }
}





/**/
var WindowChat = {
    chatContainer: document.querySelector(".messages-container"),
    
    createRoomCard: function(room){
        var tag_a = document.createElement('a')
        tag_a.setAttribute("room",room.name)

            var roomCard = document.createElement('article');
            roomCard.className = "room"

            var roomName = document.createElement('span');
            roomName.className = "room__name";
        
            var roomLastMessage = document.createElement('span');
            roomLastMessage.className = "room__last-msg";
        
//            var roomLastMessageDate = document.createElement('span');
//            roomLastMessageDate.className = "room__last-msg-date";

            var roomUsers = document.createElement('span');
            roomUsers.className = "room__users";

            var roomCardsBox = document.querySelector(".room-cards");

            roomCardsBox.appendChild(tag_a);
            tag_a.appendChild(roomCard);
            roomCard.appendChild(roomName);
            roomCard.appendChild(roomLastMessage);
//          roomCard.appendChild(roomLastMessageDate);
            roomCard.appendChild(roomUsers);
        
            tag_a.addEventListener('click', function(){
                var room = this.attributes.room.value;
                
                if(Room.all[room].password){
                    Room.all[room].addUser(user, prompt("Podaj hasło: "));
                }else{
                    Room.all[room].addUser(user);
                }
            });
        WindowChat.updateRoomCard(room)
    },
    
    updateRoomCard: function(room){
        var roomElement = document.querySelector('[room="' + room.name + '"]');
        
        roomElement.querySelector(".room__name").innerHTML = room.name;
        //roomElement.querySelector(".room__last-msg-date").innerHTML
        roomElement.querySelector(".room__last-msg").innerHTML = WindowChat.getLastMessage(room).substring(0, 32) + "...";
        roomElement.querySelector(".room__users").innerHTML = (room.members.length ? room.members.length : 0) +" / "+room.maxMembers;
    },
    
    updateInfoAboutRoom: function(){
        if(user.room){
            var room = Room.all[user.room];
            var roomNameElement = document.querySelector('.chat-info__room-name');
            var roomUsersElement = document.querySelector('.chat-info__users');

            roomNameElement.innerHTML = room.name;
            roomUsersElement.innerHTML = room.members.length + ' / ' + room.maxMembers;
        }
    },
    
    createMessage: function(message){
        /*
            <article class="message">
               <span class="message__author">Author</span>
               <p class="message__content">Sample content - Sample content - Sample content</p>
            </article>
        */
        var article = document.createElement('article');
        article.classList.add("message");

        var span = document.createElement('span');
        span.classList.add("message__author");
        span.innerHTML = message.author;

        var p = document.createElement('p');
        p.classList.add('message__content');
        p.innerHTML = message.content;

        span.appendChild(p);
        article.appendChild(span);
        
        this.chatContainer.appendChild(article);
    },
    
    showNickUser: function(nick){
        document.querySelector(".user-nick").innerHTML = nick;
    },
    
    getLastMessage: function(room){
        return room.password ? "Tajne wiadomości" : (room.lastMessage ? room.lastMessage.author + ": " + room.lastMessage.content : "Brak wiadomości");
    },
    
    scrollInBottom: function(){
        return (this.chatContainer.scrollTop + this.chatContainer.clientHeight > 0.95 * this.chatContainer.scrollHeight) ? true : false;
    },
    
    setScrollInBottom: function(){
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    },
    
    deleteAllMessages: function(){
        WindowChat.chatContainer.innerHTML = "";
    },
    
    replaceMessagesInChatWindow: function(roomName){
        messages = Room.all[roomName].messages;
        
        WindowChat.deleteAllMessages();
        
        messages.forEach(function(item){
            WindowChat.createMessage(item)
        })
    }
}





/**/
user.on("chat-message", function(messageFromServer){
    Room.all[messageFromServer.room].addMessage(messageFromServer)
})


user.on("updateRoomData", function(roomsData){
    roomsData.forEach(function(item){
        if(Room.all[item.name]){
            Room.all[item.name].updateData(item);
        }else{
            Room.addRoom(item);
            WindowChat.createRoomCard(item);
        }
    })
    WindowChat.updateInfoAboutRoom();
});


user.on("nick", function(nick){
    if(nick){
        this.nick = nick
        WindowChat.showNickUser(nick);
    }else{
        user.login();
    }
});

user.on("roomAddUser", function(roomName){
    user.room = roomName;
});


user.on("messagesFromRoom", function(messages){
    var room = Room.all[user.room];
    var lastIdClientMessage = room.messages.length > 0 ? room.messages[room.messages.length-1].id : 0;
    
    messages.forEach(function(item){
        if(item.id > lastIdClientMessage){
            room.addMessage(item);
        }
    })
    
    WindowChat.replaceMessagesInChatWindow(user.room)
});

user.on("info", function(infoMessage){
    alert(infoMessage)
});





/**/
function sendMessage(){
    var messageInput = document.getElementById('chat_input');
    var reg =  /\S/
    if((user.room && messageInput.value != '') && reg.test(messageInput.value)){        
        var message = new Message(messageInput.value, user.nick, user.room)

        user.emit("chat-message", message)
        messageInput.value = '';
    }else{
        alert("Błąd wysyłana. Dołącz do pokoju lub napisz wiadomość!")
    }    
}

document.getElementById('send-message').addEventListener('click', function(event){
    event.preventDefault();
    sendMessage();
},false);

KeyHandling = {
    allKeysPress: [],
    keyDown: function(e){
        var char = e.charCode || e.keyCode;
        
        if(!(KeyHandling.allKeysPress.indexOf(char)+1)){
            KeyHandling.allKeysPress.push(char);
        }        
    },
    
    keyUp:function(e){
        KeyHandling.allKeysPress.splice(KeyHandling.allKeysPress.indexOf(e.charCode || e.keyCode),1);
    },
    
    onEnter:function(e){
        var keyCodeOfEnter = 13;
        var keyCodeOfShift = 16;
        
        if(((e.charCode || e.keyCode) == keyCodeOfEnter) && !(KeyHandling.allKeysPress.indexOf(keyCodeOfShift)+1)){
            e.preventDefault();
            sendMessage();
        }
    }
}
document.addEventListener("keydown", function(e){
    KeyHandling.keyDown(e)
    KeyHandling.onEnter(e);
}, false)
document.addEventListener("keyup", function(e){
    KeyHandling.keyUp(e);
}, false)





/**/
function hasClass(element, className){
    for(var i in element.classList){
        if(element.classList[i] == className){
            return true
        }
    }
    return false
}

function showSidePanel(){
    document.querySelector(".panel-trigger").addEventListener("click", function(){
        var panel = this.parentNode.parentNode;
        if(hasClass(panel, "left-panel__show")){
            panel.classList.remove("left-panel__show");
        }else{
            panel.classList.add("left-panel__show");
        }
    },false)
}





/**/
window.onload = function(){
    user.login();
}