export type IdCategorieRaport =
  | 'utilizatori'
  | 'incidente'
  | 'dispozitive'
  | 'alerte'
  | 'retea'
  | 'ml'
  | 'audit'

export interface CategorieRaport {
  id: IdCategorieRaport
  titlu: string
  subtitlu: string
  icon: string
}

export interface ElementTabelRaport {
  id: string
  titlu: string
  data: string
  severitate?: string
  stare?: string
  dispozitiv?: string
  detalii: string
}

export interface StatisticaRaport {
  eticheta: string
  valoare: number | string
}

export interface RaportSalvat {
  id: string
  titlu: string
  categorie: IdCategorieRaport
  numeCategorie: string
  generatLa: string
  generatDe: string
  perioadaInceput: string
  perioadaSfarsit: string
  sumar: string
  statistici: StatisticaRaport[]
  elemente: ElementTabelRaport[]
  recomandari: string[]
}

export interface ParametriGenerareRaport {
  categorie: IdCategorieRaport
  perioadaInceput: string
  perioadaSfarsit: string
  titlu?: string
  generatDe?: string
}
