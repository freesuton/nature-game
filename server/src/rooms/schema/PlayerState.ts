import { Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type("number")
  x: number = 100;

  @type("number")
  y: number = 450;

  @type("number")
  velocityX: number = 0;

  @type("number")
  velocityY: number = 0;

  @type("boolean")
  onGround: boolean = true;
}