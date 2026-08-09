let pc,dc,stream,started=false,userMsg=null,gptMsg=null;
const $=x=>document.getElementById(x),chat=$("chat"),status=$("status");

function stat(t,c=""){status.textContent="● "+t;status.className="status "+c}
function clearHint(){chat.querySelector(".hint")?.remove()}
function add(role,text="",partial=false){
 clearHint();
 const d=document.createElement("div");
 d.className="msg "+role+(partial?" partial":"");
 d.innerHTML=`<div class="role">${role==="user"?"YOU":"GPT INTERVIEWER"}</div><div class="body"></div>`;
 d.querySelector(".body").textContent=text;
 chat.appendChild(d);chat.scrollTop=chat.scrollHeight;return d;
}
function append(d,t){if(!d)return;d.querySelector(".body").textContent+=(t||"");chat.scrollTop=chat.scrollHeight}
function send(x){if(dc?.readyState==="open")dc.send(JSON.stringify(x))}

async function start(){
 if(started)return;
 try{
  stat("Requesting microphone...","thinking");
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
  pc=new RTCPeerConnection();
  stream.getTracks().forEach(t=>pc.addTrack(t,stream));
  dc=pc.createDataChannel("oai-events");
  dc.onopen=()=>{
   started=true;$("start").disabled=true;$("stop").disabled=false;
   stat("Listening automatically","on");
   send({type:"conversation.item.create",item:{type:"message",role:"user",content:[{type:"input_text",text:"Start the interview. Ask me the first question now."}]}});
   send({type:"response.create",response:{output_modalities:["text"]}});
  };
  dc.onmessage=e=>{try{handle(JSON.parse(e.data))}catch(err){console.error(err)}};
  dc.onerror=()=>stat("Connection error","err");
  const offer=await pc.createOffer();await pc.setLocalDescription(offer);await ice();
  const r=await fetch("/api/realtime",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sdp:pc.localDescription.sdp})});
  if(!r.ok)throw new Error(await r.text());
  await pc.setRemoteDescription({type:"answer",sdp:await r.text()});
  stat("Listening automatically","on");
 }catch(e){console.error(e);stat(e.message||"Could not start","err");cleanup()}
}
function ice(){
 if(pc.iceGatheringState==="complete")return Promise.resolve();
 return new Promise(ok=>{const f=()=>{if(pc.iceGatheringState==="complete"){pc.removeEventListener("icegatheringstatechange",f);ok()}};pc.addEventListener("icegatheringstatechange",f)})
}
function handle(x){
 switch(x.type){
  case"input_audio_buffer.speech_started":stat("Listening to you...","on");break;
  case"input_audio_buffer.speech_stopped":stat("Thinking...","thinking");break;
  case"conversation.item.input_audio_transcription.delta":if(!userMsg)userMsg=add("user","",true);append(userMsg,x.delta);break;
  case"conversation.item.input_audio_transcription.completed":
   if(userMsg){userMsg.classList.remove("partial");if(x.transcript)userMsg.querySelector(".body").textContent=x.transcript}
   userMsg=null;break;
  case"response.output_text.delta":if(!gptMsg)gptMsg=add("gpt","",true);append(gptMsg,x.delta);stat("GPT is answering...","thinking");break;
  case"response.done":if(gptMsg)gptMsg.classList.remove("partial");gptMsg=null;stat("Listening automatically","on");break;
  case"error":console.error(x);stat(x.error?.message||"OpenAI error","err");break;
 }
}
function cleanup(){try{dc?.close()}catch{}try{pc?.close()}catch{}stream?.getTracks().forEach(t=>t.stop());pc=null;dc=null;stream=null;userMsg=null;gptMsg=null}
$("start").onclick=start;
$("stop").onclick=()=>{cleanup();started=false;$("start").disabled=false;$("stop").disabled=true;stat("Stopped")};
addEventListener("beforeunload",cleanup);
