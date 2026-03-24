/** Supabase 테이블 타입 (DDL 기준) */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface CustomerRow {
  cardcode: string;
  cardname: string | null;
  groupcode: number | null;
  address: string | null;
  zipcode: string | null;
  phone1: string | null;
  phone2: string | null;
  fax: string | null;
  cntctprsn: string | null;
  notes: string | null;
  e_mail: string | null;
  shiptodef: string | null;
  vatregnum: string | null;
  repname: string | null;
  aliasname: string | null;
  billtodef: string | null;
  u_delyn: string | null;
}

export interface ItemlistRow {
  itemcode: string;
  itemname: string | null;
  itmsgrpcod: number | null;
  codebars: string | null;
  brand: string | null;
  itemgb: string | null;
}

export interface SalesRow {
  id?: number;
  docentry: number;
  linenum: number;
  itemcode: string | null;
  quantity: number | null;
  price: number | null;
  discprcnt: number | null;
  pricebefdi: number | null;
  docdate: string | null;
  basecard: string | null;
  totalsumsy: number | null;
  vatsumsy: number | null;
  linestatus: string | null;
}

export interface InamtRow {
  docentry: number;
  docdate: string | null;
  cardcode: string | null;
  doctotal: number | null;
}

export interface SaleetcRow {
  id?: number;
  docentry: number;
  linenum: number;
  itemcode: string | null;
  quantity: number | null;
  docdate: string | null;
  basecard: string | null;
}

export interface OrdersRow {
  docentry: number;
  linenum: number;
  docdate: string | null;
  basecard: string | null;
  cardname: string | null;
  aliasname: string | null;
  itemcode: string | null;
  itemname: string | null;
  price: number | null;
  supply_rate: number | null;
  discount_rate: number | null;
  quantity: number | null;
  totalsumsy: number | null;
  vatamt: number | null;
  returnamt: number | null;
}

export interface MenuRow {
  id: string;
  path: string;
  label: string;
  sort_order: number;
}

export interface UserMenuPermissionRow {
  email: string;
  menu_id: string;
}

export interface Database {
  public: {
    Tables: {
      customer: { Row: CustomerRow; Insert: Omit<CustomerRow, never>; Update: Partial<CustomerRow> };
      itemlist: { Row: ItemlistRow; Insert: ItemlistRow; Update: Partial<ItemlistRow> };
      sales: { Row: SalesRow; Insert: Omit<SalesRow, "id">; Update: Partial<SalesRow> };
      inamt: { Row: InamtRow; Insert: InamtRow; Update: Partial<InamtRow> };
      saleetc: { Row: SaleetcRow; Insert: Omit<SaleetcRow, "id">; Update: Partial<SaleetcRow> };
      menus: { Row: MenuRow; Insert: MenuRow; Update: Partial<MenuRow> };
      user_menu_permissions: { Row: UserMenuPermissionRow; Insert: UserMenuPermissionRow; Update: Partial<UserMenuPermissionRow> };
    };
  };
}
