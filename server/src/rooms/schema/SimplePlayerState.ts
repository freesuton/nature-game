import { Schema, type } from '@colyseus/schema';

export class SimplePlayerState extends Schema {
  @type("number") x: number = 400;
  @type("number") y: number = 500;
  @type("boolean") movingLeft: boolean = false;
  @type("boolean") movingRight: boolean = false;
  @type("string") color: string = "#FF6B6B"; // Store player color as hex string
  @type("string") facingDirection: string = "right"; // Store player's facing direction ('left' or 'right')
  @type("boolean") hasWeapon: boolean = false; // Track if player has a weapon
  @type("string") weaponType: string = ""; // Track the type of weapon the player has
  @type("boolean") isDead: boolean = false; // Track if player is dead
}