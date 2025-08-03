import { Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type("number")
  x: number = 100;

  @type("number")
  y: number = 450;

  @type("number")
  facingDirection: number = 1;

  @type("boolean")
  isMoving: boolean = false;
}