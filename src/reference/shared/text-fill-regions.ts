import { VECTOR_MAP_ITEMS } from './administrative-regions.generated';

export type TextFillRegionOption = {
  key: string;
  adcode: number;
  name: string;
  direct?: boolean;
};

let ITEMS_BY_ADCODE = new Map(VECTOR_MAP_ITEMS.map((item) => [item.adcode, item]));
let DISTRICTS = VECTOR_MAP_ITEMS.filter((item) => item.level === 'district');
let DISTRICT_PARENT_CODES = new Set(DISTRICTS.map((item) => item.parentAdcode));
export function refreshRegionIndex(){ITEMS_BY_ADCODE=new Map(VECTOR_MAP_ITEMS.map(item=>[item.adcode,item]));DISTRICTS=VECTOR_MAP_ITEMS.filter(item=>item.level==='district');DISTRICT_PARENT_CODES=new Set(DISTRICTS.map(item=>item.parentAdcode));}


export function getTextFillProvinceOptions(): TextFillRegionOption[] {
  return VECTOR_MAP_ITEMS
    .filter((item) => item.level === 'province' && item.parentAdcode === 100000)
    .map((item) => ({ key: String(item.adcode), adcode: item.adcode, name: item.name }));
}

export function getTextFillCityOptions(provinceAdcode: number | undefined): TextFillRegionOption[] {
  if (!provinceAdcode) return [];
  const province = ITEMS_BY_ADCODE.get(provinceAdcode);
  const cities: TextFillRegionOption[] = VECTOR_MAP_ITEMS
    .filter((item) => item.level === 'city' && item.parentAdcode === provinceAdcode && DISTRICT_PARENT_CODES.has(item.adcode))
    .map((item) => ({ key: String(item.adcode), adcode: item.adcode, name: item.name }));
  const directDistricts = DISTRICTS.filter((item) => item.parentAdcode === provinceAdcode);
  if (directDistricts.length) {
    cities.unshift({
      key: `direct:${provinceAdcode}`,
      adcode: provinceAdcode,
      name: cities.length ? '省直辖县级行政区' : province?.name ?? '市辖区',
      direct: true
    });
  }
  return cities;
}

export function getTextFillDistrictOptions(cityKey: string): TextFillRegionOption[] {
  if (!cityKey) return [];
  const parentAdcode = Number(cityKey.replace('direct:', ''));
  return DISTRICTS
    .filter((item) => item.parentAdcode === parentAdcode)
    .map((item) => ({ key: String(item.adcode), adcode: item.adcode, name: item.name }));
}

export function buildTextFillRegionValues(input: {
  provinceAdcode?: number;
  cityKey?: string;
  districtAdcode?: number;
}): string[] {
  const districts = input.districtAdcode
    ? DISTRICTS.filter((item) => item.adcode === input.districtAdcode)
    : input.cityKey
      ? DISTRICTS.filter((item) => item.parentAdcode === Number(input.cityKey?.replace('direct:', '')))
      : input.provinceAdcode
        ? districtsForProvince(input.provinceAdcode)
        : DISTRICTS;
  return districts.map(regionPathForDistrict).filter(Boolean);
}

function districtsForProvince(provinceAdcode: number) {
  const cityCodes = new Set(VECTOR_MAP_ITEMS
    .filter((item) => item.level === 'city' && item.parentAdcode === provinceAdcode)
    .map((item) => item.adcode));
  return DISTRICTS.filter((item) => item.parentAdcode === provinceAdcode || cityCodes.has(item.parentAdcode ?? -1));
}

function regionPathForDistrict(district: (typeof VECTOR_MAP_ITEMS)[number]): string {
  const parent = district.parentAdcode ? ITEMS_BY_ADCODE.get(district.parentAdcode) : undefined;
  const province = parent?.level === 'province'
    ? parent
    : parent?.parentAdcode
      ? ITEMS_BY_ADCODE.get(parent.parentAdcode)
      : undefined;
  if (!province) return district.name;
  const cityName = parent?.level === 'city' && parent.name !== province.name ? parent.name : '';
  return `${province.name}${cityName}${district.name}`;
}
