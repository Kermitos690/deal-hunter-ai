import type { ConditionGrade } from "@/types";

export type RadarTemplate = {
  id:string; title:string; description:string; category:string; brands:string[];
  include_keywords:string[]; exclude_keywords:string[]; accepted_conditions:ConditionGrade[];
  sale_types:string[]; min_roi_percent:number; min_profit:number;
};

export const RADAR_TEMPLATES: RadarTemplate[] = [
  {id:"lv-vintage",title:"Louis Vuitton vintage B/C",description:"Pièces vintage avec défauts revendables.",category:"Sacs et accessoires",brands:["Louis Vuitton"],include_keywords:["vintage"],exclude_keywords:["fake","replica","inspired"],accepted_conditions:["B","C"],sale_types:["BUY_NOW","AUCTION"],min_roi_percent:20,min_profit:80},
  {id:"japan-watches",title:"Montres japonaises sous-cotées",description:"Montres d’occasion provenant du Japon.",category:"Montres",brands:["Seiko","Citizen","Orient"],include_keywords:[],exclude_keywords:["replica","parts only"],accepted_conditions:["A","B","C","REPAIR"],sale_types:["BUY_NOW","AUCTION"],min_roi_percent:20,min_profit:60},
  {id:"luxury-lots",title:"Lots luxe grade B/C",description:"Lots à trier pour revente unitaire.",category:"Sacs et accessoires",brands:[],include_keywords:["lot"],exclude_keywords:["replica","inspired"],accepted_conditions:["B","C"],sale_types:["BUY_NOW","AUCTION"],min_roi_percent:25,min_profit:150},
  {id:"repair-premium",title:"Accessoires premium à retaper",description:"Produits réparables avec marge prudente.",category:"Sacs et accessoires",brands:[],include_keywords:["repair"],exclude_keywords:["replica"],accepted_conditions:["C","REPAIR"],sale_types:["BUY_NOW","AUCTION"],min_roi_percent:30,min_profit:100},
  {id:"ending-auctions",title:"Enchères finissant bientôt",description:"Enchères avec date de fin disponible.",category:"Montres",brands:[],include_keywords:[],exclude_keywords:["replica"],accepted_conditions:["A","B","C"],sale_types:["AUCTION"],min_roi_percent:15,min_profit:50},
  {id:"low-risk-margin",title:"Marge après frais, risque faible",description:"Produits en bon état avec photos.",category:"Objets de collection",brands:[],include_keywords:[],exclude_keywords:["fake","replica","damaged"],accepted_conditions:["NEW","A","B"],sale_types:["BUY_NOW"],min_roi_percent:20,min_profit:75}
];

export function radarTemplate(id?:string) {
  return RADAR_TEMPLATES.find((template)=>template.id===id);
}
