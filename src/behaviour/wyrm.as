// The Dust Wyrm (BM-5, TC-B5), Brasscap Mesa's boss: three strikes (burst, tail sweep, sand spit from phase 2), each
// told by the sand ring, then its gullet opens to rounds.
// Engine strike rows own the contact; this source drives the tell and gullet shared fields and the encounter guard
// (TE-ENG1). guard: 0 every hit, 1 none, 2 melee only, 3 the rest only (rounds). The Wyrm never leaves its mound, so the
// sand-ring and gullet particles round it stay on it. `wildshard build` compiles it with sharddev's decision compiler
// from `rows/sim/scripts.json`'s bindings.
import { Actor, Strike, Field, Timer, State, Params, Do, Read, Event } from './generated/brasscapWyrmDecision';
function beatSeconds():f64 { return State.phase==2?Params.secondBeat:Params.firstBeat; }
function quiet():void { Do.field(0,Field.tell,0); Do.field(0,Field.gullet,0); Do.timer(Timer.arm,0); Do.timer(Timer.beat,0); Do.timer(Timer.open,0); Do.timer(Timer.shut,0); }
// A strike: the sand ring rises and the guard shuts while it rears; the strike lands at the windup's end, then the gullet
// opens. The first phase alternates the burst (round its mound) and the tail sweep; the second adds the sand spit.
function strike(which:i32):void {
  Do.field(0,Field.tell,1); Do.encounter(4,1);
  const target=Read.nearestPlayer(Actor.boss);
  if(target!=0) Do.strike(Actor.boss,which,target);
  Do.timer(Timer.open,Params.windup);
}
function next():void {
  State.beat=(State.beat+1)%(State.phase==2?3:2);
  if(State.beat==0) strike(Strike.burst); else if(State.beat==1) strike(Strike.sweep); else strike(Strike.spit);
}
// A phase change stops and restarts the decision, and a retry restarts it at its checkpoint: resume from its health.
export function onStart():void {
  if(State.phase==3) return;
  if(State.phase==0) Do.encounterPhase(0);
  State.phase=Read.hpShare(Actor.boss)>0.5?1:2; // 0.5: the second phase's `at` in encounters.json
  Do.encounter(4,1); Do.timer(Timer.arm,0.02); Do.timer(Timer.beat,beatSeconds());
}
// No guard reset here: a phase change stops and restarts the decision, and the guard stays shut across it. Engine itself
// opens the guard at a checkpoint reset and at victory.
export function onStop():void { Do.stop(Actor.boss); quiet(); }
export function onThreshold(index:i32):void {
  if(i32(Event.subject)!=Actor.boss || index!=1 || State.phase!=1) return;
  State.phase=2; Do.encounterPhase(1);
}
export function onDeath(killer:i32):void {
  if(i32(Event.subject)!=Actor.boss || (State.phase!=1 && State.phase!=2)) return;
  Do.stop(Actor.boss); quiet(); State.phase=3; Do.encounterWin();
}
export function onTimer(timer:i32):void {
  if(State.phase!=1 && State.phase!=2) return;
  if(timer==Timer.arm) Do.encounter(4,1); // the fight's start opens the guard after onStart, so shut it again a tick later
  else if(timer==Timer.beat) next();
  else if(timer==Timer.open) { Do.field(0,Field.tell,0); Do.field(0,Field.gullet,1); Do.encounter(4,3); Do.timer(Timer.shut,Params.window); }
  else if(timer==Timer.shut) { Do.field(0,Field.gullet,0); Do.encounter(4,1); Do.timer(Timer.beat,beatSeconds()); }
}
