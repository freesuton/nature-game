import { Schema, type } from '@colyseus/schema';

export class SimplePlayerState extends Schema {
  @type("number") x: number = 400;
  @type("number") y: number = 500;
  @type("boolean") movingLeft: boolean = false;
  @type("boolean") movingRight: boolean = false;
}