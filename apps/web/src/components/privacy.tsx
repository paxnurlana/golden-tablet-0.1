"use client";
import type {ReactNode} from 'react';
// Compatibility for chart formatters: the portfolio always displays its demo amounts.
export const usePrivacy=()=>false;
export function MonetaryValue({children}:{children:ReactNode}){return <>{children}</>;}
export function MonetaryField({children}:{children:ReactNode;sensitive?:boolean}){return <>{children}</>;}
