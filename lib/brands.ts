import { Brand, BrandTheme } from './types'

export const BRAND_THEMES: Record<Brand, BrandTheme> = {
  Froo: {
    name: 'Froo',
    primary: '#C0392B',
    secondary: '#F9E8E4',
    textOnPrimary: '#FFFFFF',
    bodyText: '#2C2C2C',
  },
  'Sweet Threads': {
    name: 'Sweet Threads',
    primary: '#F4C2C2',
    secondary: '#FFFFFF',
    textOnPrimary: '#3A3A3A',
    bodyText: '#3A3A3A',
  },
  Prairie: {
    name: 'Prairie',
    primary: '#8FAF8A',
    secondary: '#F5F0E8',
    textOnPrimary: '#FFFFFF',
    bodyText: '#3A3A3A',
  },
  'Soirée': {
    name: 'Soirée',
    primary: '#EDE0E8',
    secondary: '#FAFAFA',
    textOnPrimary: '#3A3A3A',
    bodyText: '#3A3A3A',
  },
}

export function getBrandTheme(brand: Brand | null): BrandTheme {
  return brand ? BRAND_THEMES[brand] : BRAND_THEMES.Froo
}
