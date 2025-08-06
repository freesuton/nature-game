import { Schema, MapSchema, type } from '@colyseus/schema';
import { SimplePlayerState } from './SimplePlayerState';

export class SimpleGameState extends Schema {
  @type({ map: SimplePlayerState }) players = new MapSchema<SimplePlayerState>();
}