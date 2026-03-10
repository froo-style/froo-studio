export type Brand = 'Froo' | 'Sweet Threads' | 'Prairie' | 'Soirée'
export type Category = 'Baby' | 'Girls' | 'Boys' | 'Preteen' | 'Teen'
export type SampleSize = '2' | '6' | '8' | '16' | '18' | 'M'

export interface BrandTheme {
  name: Brand
  primary: string
  secondary: string
  textOnPrimary: string
  bodyText: string
}

export interface DesignNotes {
  silhouette: string
  construction: string
  closures: string
  neckline: string
  sleeves: string
  hemFinish: string
  trims: string[]
  additionalNotes: string
  rawText: string
}

export interface FabricInfo {
  type: 'uploaded' | 'ai-suggested' | 'factory-source'
  description: string
  imageData?: string
  vendorName?: string
  vendorContact?: string
  composition?: string
  color?: string
}

export interface TrimInfo {
  trimType: string
  sourceType: 'uploaded' | 'ai-suggested' | 'factory-source'
  description: string
  color?: string
  usageNotes?: string
  vendorContact?: string
  imageData?: string
}

export interface GeneratedVisual {
  type: 'flat-front' | 'flat-back' | 'mockup-front' | 'mockup-back' | 'bg-removed' | 'detail-callout'
  label: string
  imageData?: string
  status: 'pending' | 'generating' | 'done' | 'error'
  error?: string
}

export interface SizeChart {
  type: 'repeat' | 'new-block' | 'uploaded'
  data?: string
  imageData?: string
  name?: string
}

export interface TechPackData {
  brand: Brand | null
  category: Category | null
  sampleSize: SampleSize | null
  sampleNumber: string
  inspirationImage: string | null
  inspirationImageNoBackground?: string
  designNotes: DesignNotes | null
  visuals: GeneratedVisual[]
  baseFabric: FabricInfo | null
  lining: FabricInfo | null
  trims: TrimInfo[]
  sizeChart: SizeChart | null
  status: 'intake' | 'visuals' | 'fabric' | 'sizechart' | 'complete' | 'draft'
}

export interface ChatMessage {
  id: string
  role: 'assistant' | 'user' | 'system'
  content: string
  images?: string[]
  buttons?: ButtonOption[]
  isLoading?: boolean
  component?: 'image-upload' | 'text-input' | 'visuals-gallery' | 'fabric-card' | 'size-chart' | 'tech-pack-preview' | 'trim-input'
  componentData?: Record<string, unknown>
}

export interface ButtonOption {
  label: string
  value: string
  variant?: 'primary' | 'secondary' | 'outline'
}

export const BRAND_PREFIXES: Record<Brand, string> = {
  'Froo': 'F',
  'Sweet Threads': 'ST',
  'Prairie': 'P',
  'Soirée': 'S',
}
