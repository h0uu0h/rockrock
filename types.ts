
import { Vector3 } from 'three';

export enum Biome {
  BEACH = 'BEACH',
  MOUNTAIN = 'MOUNTAIN',
  FISHTANK = 'FISHTANK',
  DESERT = 'DESERT',
  RAINFOREST = 'RAINFOREST',
  TUNDRA = 'TUNDRA',
  HOT_SPRING = 'HOT_SPRING',
  VOLCANO = 'VOLCANO',
  THEME_PARK = 'THEME_PARK',
  OLD_HOUSE = 'OLD_HOUSE',
  SEWER = 'SEWER',
  TEMPLE = 'TEMPLE',
}

export type Rarity = 'COMMON' | 'RARE' | 'ETERNAL';

export interface Card {
  id: string;
  objectType: string;
  biome: Biome;
  year: number;
  description: string;
  sound: string;
  timestamp: string;
  rarity: Rarity;
  color: string;
}

export interface WorldObject {
  id: string;
  type: string;
  position: Vector3;
  scale: number;
  rotation: [number, number, number];
  color: string;
}

export interface InteractionLog {
  id: string;
  year: number;
  text: string;
  sound: string;
  timestamp: string;
  objectName: string;
}
