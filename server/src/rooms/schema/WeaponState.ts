import { Schema, type } from '@colyseus/schema';
import { BulletState } from './BulletState';

export class WeaponState extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("boolean") isPickedUp: boolean = false;
  @type("string") weaponType: string = "";
  @type("string") weaponName: string = "";
  @type("number") attackRange: number = 50;
  @type("number") weaponColor: number = 0xC0C0C0; // Hex color for weapon body
  @type("number") strokeColor: number = 0x4169E1; // Hex color for weapon outline
  @type("string") labelColor: string = "#4169E1"; // CSS color for weapon label
  @type(BulletState) bulletState?: BulletState; // Bullet configuration for long-range weapons

  constructor(weaponType: string = "weapon") {
    super();
    this.weaponType = weaponType;
    
    // Initialize weapon properties based on type
    switch (weaponType) {
      case "gun":
        this.weaponName = "Gun";
        this.attackRange = 200;
        this.weaponColor = 0x8B4513;  // Brown
        this.strokeColor = 0xFFFF00;  // Yellow outline
        this.labelColor = "#FFFF00";  // Yellow label
        // Long-range weapon gets bullet state
        this.bulletState = new BulletState();
        break;
      case "sword":
        this.weaponName = "Sword";
        this.attackRange = 60;
        this.weaponColor = 0xC0C0C0;  // Silver
        this.strokeColor = 0x4169E1;  // Blue outline
        this.labelColor = "#4169E1";  // Blue label
        break;
      default:
        this.weaponName = "Tool";
        this.attackRange = 50;
        this.weaponColor = 0x808080;  // Gray
        this.strokeColor = 0xFFFFFF;  // White outline
        this.labelColor = "#FFFFFF";  // White label
        break;
    }
  }
}
