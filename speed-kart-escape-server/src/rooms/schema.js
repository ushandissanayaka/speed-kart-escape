import { Schema, MapSchema, defineTypes } from '@colyseus/schema';

export class PlayerState extends Schema {
  constructor() {
    super();
    this.name = 'Player';
    this.x = 0;
    this.z = 0;
    this.ry = 0;
    this.v = 0;
    this.kart = 'noob';
    this.trail = 'none';
    this.avatar = ''; // JSON: { equipped, proportions, skinUrl }
    this.speed = 0;
    this.isGuest = true;
    this.legionId = ''; // Boxity user id (chat bubbles, invites)
  }
}
defineTypes(PlayerState, {
  name: 'string',
  x: 'float32',
  z: 'float32',
  ry: 'float32',
  v: 'float32',
  kart: 'string',
  trail: 'string',
  avatar: 'string',
  speed: 'float64',
  isGuest: 'boolean',
  legionId: 'string',
});

export class StartingPlaceState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
  }
}
defineTypes(StartingPlaceState, {
  players: { map: PlayerState },
});
