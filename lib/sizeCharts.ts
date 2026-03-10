export interface SizeChartTemplate {
  name: string
  category: string
  garmentType: string
  measurements: Record<string, Record<string, number>>
}

export const SIZE_CHART_TEMPLATES: SizeChartTemplate[] = [
  {
    name: 'Girls Dress Standard',
    category: 'Girls',
    garmentType: 'dress',
    measurements: {
      'Chest': { '2': 21, '4': 23, '6': 25, '8': 27, '10': 29, '12': 31 },
      'Waist': { '2': 20, '4': 21, '6': 22, '8': 23.5, '10': 25, '12': 26.5 },
      'Hip': { '2': 22, '4': 24, '6': 26, '8': 28, '10': 30, '12': 32 },
      'Length (HPS)': { '2': 17, '4': 19, '6': 21, '8': 23, '10': 25, '12': 27 },
      'Sleeve Length': { '2': 4, '4': 4.5, '6': 5, '8': 5.5, '10': 6, '12': 6.5 },
    },
  },
  {
    name: 'Girls Top Standard',
    category: 'Girls',
    garmentType: 'top',
    measurements: {
      'Chest': { '2': 21, '4': 23, '6': 25, '8': 27, '10': 29, '12': 31 },
      'Waist': { '2': 20, '4': 21, '6': 22, '8': 23.5, '10': 25, '12': 26.5 },
      'Length (HPS)': { '2': 12, '4': 13, '6': 14.5, '8': 16, '10': 17.5, '12': 19 },
      'Sleeve Length': { '2': 4, '4': 4.5, '6': 5, '8': 5.5, '10': 6, '12': 6.5 },
    },
  },
  {
    name: 'Girls Skirt Standard',
    category: 'Girls',
    garmentType: 'skirt',
    measurements: {
      'Waist': { '2': 20, '4': 21, '6': 22, '8': 23.5, '10': 25, '12': 26.5 },
      'Hip': { '2': 22, '4': 24, '6': 26, '8': 28, '10': 30, '12': 32 },
      'Length': { '2': 9, '4': 10.5, '6': 12, '8': 13.5, '10': 15, '12': 16.5 },
    },
  },
  {
    name: 'Girls Pant Standard',
    category: 'Girls',
    garmentType: 'pant',
    measurements: {
      'Waist': { '2': 20, '4': 21, '6': 22, '8': 23.5, '10': 25, '12': 26.5 },
      'Hip': { '2': 22, '4': 24, '6': 26, '8': 28, '10': 30, '12': 32 },
      'Inseam': { '2': 9, '4': 12, '6': 15, '8': 18, '10': 21, '12': 24 },
      'Outseam': { '2': 15, '4': 18.5, '6': 22, '8': 25.5, '10': 29, '12': 32.5 },
      'Thigh': { '2': 9, '4': 10, '6': 11, '8': 12, '10': 13, '12': 14 },
    },
  },
  {
    name: 'Baby Romper Standard',
    category: 'Baby',
    garmentType: 'romper',
    measurements: {
      'Chest': { '0-3M': 17, '3-6M': 18, '6-12M': 19, '12-18M': 20, '18-24M': 21 },
      'Waist': { '0-3M': 16, '3-6M': 17, '6-12M': 18, '12-18M': 19, '18-24M': 20 },
      'Length': { '0-3M': 14, '3-6M': 15.5, '6-12M': 17, '12-18M': 18.5, '18-24M': 20 },
      'Inseam': { '0-3M': 3, '3-6M': 3.5, '6-12M': 4, '12-18M': 4.5, '18-24M': 5 },
    },
  },
  {
    name: 'Boys Shirt Standard',
    category: 'Boys',
    garmentType: 'shirt',
    measurements: {
      'Chest': { '2': 22, '4': 24, '6': 26, '8': 28, '10': 30, '12': 32 },
      'Length (HPS)': { '2': 13, '4': 14.5, '6': 16, '8': 17.5, '10': 19, '12': 20.5 },
      'Sleeve Length': { '2': 4.5, '4': 5, '6': 5.5, '8': 6, '10': 6.5, '12': 7 },
      'Neck': { '2': 10, '4': 10.5, '6': 11, '8': 11.5, '10': 12, '12': 12.5 },
    },
  },
  {
    name: 'Teen Top Standard',
    category: 'Teen',
    garmentType: 'top',
    measurements: {
      'Chest': { 'XS': 30, 'S': 32, 'M': 34, 'L': 36, 'XL': 38 },
      'Waist': { 'XS': 25, 'S': 27, 'M': 29, 'L': 31, 'XL': 33 },
      'Length (HPS)': { 'XS': 22, 'S': 23, 'M': 24, 'L': 25, 'XL': 26 },
      'Sleeve Length': { 'XS': 7, 'S': 7.5, 'M': 8, 'L': 8.5, 'XL': 9 },
    },
  },
]

export function findMatchingCharts(category: string, garmentType?: string): SizeChartTemplate[] {
  return SIZE_CHART_TEMPLATES.filter(t => {
    const catMatch = t.category.toLowerCase() === category.toLowerCase()
    if (garmentType) {
      return catMatch && t.garmentType.toLowerCase().includes(garmentType.toLowerCase())
    }
    return catMatch
  })
}
