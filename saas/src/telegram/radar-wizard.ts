const KNOWN_BRANDS = [
  "Louis Vuitton","TAG Heuer","Rolex","Tissot","Omega","Prada","Fendi","Gucci",
  "Hermès","Hermes","Seiko","Citizen","Orient","Chanel","Dior","Cartier","Breitling"
];

const normalized=(value:string)=>value.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase();

export function parseBrands(value:string) {
  const clean=value.trim().replace(/\s+/g," ");
  if(!clean) return [];
  const haystack=normalized(clean);
  const detected=KNOWN_BRANDS.filter((brand)=>haystack.includes(normalized(brand)));
  if(detected.length) return [...new Set(detected.map((brand)=>brand==="Hermes"?"Hermès":brand))];
  return clean.split(/[,;\n]+/).map((brand)=>brand.trim()).filter(Boolean);
}

export function positiveNumber(value:string) {
  const number=Number(value.replace(/['\s]/g,"").replace(",","."));
  return Number.isFinite(number)&&number>0?number:null;
}

export const categoryKeyboard = { inline_keyboard:[
  [{text:"⌚ Montres",callback_data:"wizcat:Montres"},{text:"👜 Sacs",callback_data:"wizcat:Sacs et accessoires"}],
  [{text:"👟 Sneakers",callback_data:"wizcat:Sneakers"},{text:"💎 Bijoux",callback_data:"wizcat:Bijoux"}],
  [{text:"🃏 Cartes",callback_data:"wizcat:Cartes à collectionner"},{text:"🏺 Collection",callback_data:"wizcat:Objets de collection"}]
]};
export const conditionKeyboard = { inline_keyboard:[
  [{text:"✨ Neuf + excellent",callback_data:"wizcond:NEW,A"},{text:"👍 Bon état",callback_data:"wizcond:A,B"}],
  [{text:"🛠 Usagé / réparation",callback_data:"wizcond:B,C,REPAIR"},{text:"🌐 Tous les états",callback_data:"wizcond:NEW,A,B,C,REPAIR,UNKNOWN"}]
]};
export const sourceKeyboard = { inline_keyboard:[
  [{text:"🌍 eBay mondial",callback_data:"wizsrc:ebay"},{text:"🇯🇵 KOMEHYO",callback_data:"wizsrc:komehyo"}],
  [{text:"🔎 Toutes les sources actives",callback_data:"wizsrc:all"}]
]};
export const frequencyKeyboard = { inline_keyboard:[
  [{text:"Toutes les 6 h",callback_data:"wizfreq:360"},{text:"Toutes les 12 h",callback_data:"wizfreq:720"}],
  [{text:"Une fois par jour",callback_data:"wizfreq:1440"}]
]};
