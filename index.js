
navigator.getUserMedia = navigator.getUserMedia ||
    navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

var constraints = {video: true, audio: true}
var localStream;
var pc_config = webrtcDetectedBrowser === 'firefox' ? {'iceServers':[{'url':'stun:23.21.150.121'}]} : {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};
var pc_constraints = { 'optional': [{'DtlsSrtpKeyAgreement': true} ]};
var sdpConstraints = {};

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
// Clean-up function:
// collect garbage before unloading browser's window
window.onbeforeunload = function(e){
  hangup();
}
var peerSockets = []
var pc = {}

var room = prompt('Enter room name:');
var socket = io.connect("http://localhost:8181");
// Send 'Create or join' message to singnaling server
if (room !== '') {
  console.log('Create or join room', room);
  socket.emit('create or join', room);
}

function handleUserMedia(stream) {
        localStream = stream;
        attachMediaStream(localVideo, stream);
        console.log('Adding local stream.');
        sendMessage('got user media');
}

function handleUserMediaError(error){
        console.log('navigator.getUserMedia error: ', error);
}

socket.on('message', function (message){
  debugger
  console.log('Received message:', message);
  if (message === 'got user media') {
      checkAndStart();
  }
  else if (message.message.type === 'offer') {
    // if (!isInitiator && !isStarted)
    // {
    //   checkAndStart();
    // }
    peerSockets.push(message.senderId)

    let video = document.createElement('video');
    video.id = message.senderId;
    video.autoplay = true;
    document.getElementById("videoContainer").appendChild(video)

    pc[message.senderId] = new RTCPeerConnection(pc_config, pc_constraints);
    pc[message.senderId].addStream(localStream);
    pc[message.senderId].onicecandidate = function (event) {
              console.log('handleIceCandidate event: ', event);
              if (event.candidate) {
                sendMessageWithSocketId({
                type: 'candidate',
                label: event.candidate.sdpMLineIndex,
                id: event.candidate.sdpMid,
                candidate: event.candidate.candidate}, message.senderId);
              } else {
                console.log('End of candidates.');
              }
            }
   pc[message.senderId].onaddstream = function (event) {
                       console.log('Remote stream added.');
                       attachMediaStream(video, event.stream);
                       // console.log('Remote stream attached!!.');
                       // remoteStream = event.stream;
                     }



    pc[message.senderId].setRemoteDescription(new RTCSessionDescription(message.message));
    doAnswer(message.senderId);
    } else if (message.message.type === 'answer'){
       pc[message.senderId].setRemoteDescription(new RTCSessionDescription(message.message));
    }
    else if (message.message.type === 'candidate') {
      debugger
      var candidate = new RTCIceCandidate({sdpMLineIndex:message.message.label, candidate:message.message.candidate});
      pc[message.senderId].addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
       handleRemoteHangup();
     }
   });




socket.on('joined', function (obj){
  console.log('join in ' + obj.room);

  console.log('members in this room is: ' + obj.members)
  peerSockets = obj.members
  // isInitiator = true;
  // Call getUserMedia()
  navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
  console.log('Getting user media with constraints', constraints);
  checkAndStart();
});




function checkAndStart() {
  if (typeof localStream != 'undefined') {
      debugger
      createPeerConnection();
      console.log(pc)
      // isStarted = true;
    //   if (isInitiator){
      doCall();
    //   }
    // }
}
}


function createPeerConnection() {
  try {

    for(let i=0; i<peerSockets.length; i++){
      let video = document.createElement('video');
      video.id = peerSockets[i];
      video.autoplay = true;
      document.getElementById("videoContainer").appendChild(video)

      pc[peerSockets[i]] = new RTCPeerConnection(pc_config, pc_constraints);
      pc[peerSockets[i]].addStream(localStream);
      pc[peerSockets[i]].onicecandidate = function (event) {
                console.log('handleIceCandidate event: ', event);
                if (event.candidate) {
                  sendMessageWithSocketId({
                  type: 'candidate',
                  label: event.candidate.sdpMLineIndex,
                  id: event.candidate.sdpMid,
                  candidate: event.candidate.candidate}, peerSockets[i]);
                } else {
                  console.log('End of candidates.');
                }
              }
     pc[peerSockets[i]].onaddstream = function (event) {
                         console.log('Remote stream added.');
                         attachMediaStream(video, event.stream);
                         // console.log('Remote stream attached!!.');
                         // remoteStream = event.stream;
                       }

    }

    // console.log('Created RTCPeerConnnection with:\n' +
    //   '  config: \'' + JSON.stringify(pc_config) + '\';\n' +
    //   ' constraints: \'' + JSON.stringify(pc_constraints) + '\'.');
    } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
    }
    ;
    // pc.onremovestream = handleRemoteStreamRemoved;
}

function sendMessage(message){
  console.log('Sending message: ', message);
  socket.emit('message', message);
}

function sendMessageWithSocketId(message, socketId){
  let obj = {message: message, id: socketId}
  console.log('Sending message: ', message);
  socket.emit('message', obj);
}

function handleIceCandidate(event) {
  console.log('handleIceCandidate event: ', event);
  if (event.candidate) {
    sendMessage({
    type: 'candidate',
    label: event.candidate.sdpMLineIndex,
    id: event.candidate.sdpMid,
    candidate: event.candidate.candidate});
  } else {
    console.log('End of candidates.');
  }
}

function doAnswer(senderId) {
      console.log('Sending answer to peer.');
      pc[senderId].createAnswer(function(sessionDescription){
            debugger
            pc[senderId].setLocalDescription(sessionDescription);
            sendMessageWithSocketId(sessionDescription, senderId);
          }, onSignalingError, sdpConstraints);
}


function doCall() {
    console.log('Creating Offer...');
    keys = Object.keys(pc)
    for(let i=0; i<keys.length; i++){
      pc[keys[i]].createOffer(function(sessionDescription){
        debugger
        pc[keys[i]].setLocalDescription(sessionDescription);
        sendMessageWithSocketId(sessionDescription, keys[i]);
      }, onSignalingError, sdpConstraints);
    }
    // pc.createOffer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
  }

// function setLocalAndSendMessage(sessionDescription) {
//     pc.setLocalDescription(sessionDescription);
//     sendMessage(sessionDescription);
//   }

function onSignalingError(error) {
  console.log('Failed to create signaling message : ' + error.name);
  }

  function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    attachMediaStream(remoteVideo, event.stream);
    console.log('Remote stream attached!!.');
    remoteStream = event.stream;
  }
