import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Parses a date-only string (YYYY-MM-DD) correctly without timezone issues.
 * Adding T12:00:00 prevents the date from shifting due to timezone offset.
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Date object at noon local time
 */
export const parseDateOnly = (dateString: string): Date => {
  return new Date(dateString + 'T12:00:00');
};

/**
 * Formats a date-only string to Brazilian locale format (dd/MM/yyyy)
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @param formatPattern - Optional format pattern (default: "dd/MM/yyyy")
 * @returns Formatted date string
 */
export const formatDateBR = (dateString: string, formatPattern: string = "dd/MM/yyyy"): string => {
  return format(parseDateOnly(dateString), formatPattern, { locale: ptBR });
};

/**
 * Formats a date-only string to short Brazilian locale format (dd/MM/yy)
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string
 */
export const formatDateShortBR = (dateString: string): string => {
  return format(parseDateOnly(dateString), "dd/MM/yy", { locale: ptBR });
};

/**
 * Formats a date-only string to locale string using toLocaleDateString
 * 
 * @param dateString - Date string in YYYY-MM-DD format
 * @returns Formatted date string in pt-BR locale
 */
export const formatDateLocaleBR = (dateString: string): string => {
  return parseDateOnly(dateString).toLocaleDateString('pt-BR');
};
