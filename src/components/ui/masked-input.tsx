import * as React from "react";
import { NumericFormat, PatternFormat } from "react-number-format";
import { Input } from "./input";

// CNPJ Input
interface CNPJInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const CNPJInput = React.forwardRef<HTMLInputElement, CNPJInputProps>(
  ({ value, onValueChange, ...props }, ref) => {
    return (
      <PatternFormat
        format="##.###.###/####-##"
        mask="_"
        value={value}
        onValueChange={(values) => onValueChange(values.value)}
        customInput={Input}
        getInputRef={ref}
        type="text"
        {...props}
      />
    );
  }
);
CNPJInput.displayName = "CNPJInput";

// Phone Input
interface PhoneInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

// Função para determinar o formato do telefone baseado na quantidade de dígitos
const getPhoneFormat = (digits: string): string => {
  const len = digits.length;
  
  // Com código de país ou formato estendido (12 dígitos)
  if (len >= 12) {
    return "## (##) #####-####"; // Ex: 55 (11) 91234-5678
  }
  // Exatamente 10 dígitos confirmados como fixo (3º dígito é 2,3,4,5)
  if (len === 10) {
    const thirdDigit = digits[2];
    if (["2", "3", "4", "5"].includes(thirdDigit)) {
      return "(##) ####-####"; // Fixo com DDD: (11) 1234-5678
    }
  }
  
  // Padrão: sempre permite 11 dígitos (celular com DDD)
  return "(##) #####-####";
};

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onValueChange, ...props }, ref) => {
    const digits = (value || "").toString().replace(/\D/g, "");
    const phoneFormat = getPhoneFormat(digits);
    
    return (
      <PatternFormat
        format={phoneFormat}
        mask="_"
        value={value}
        onValueChange={(values) => onValueChange(values.value)}
        customInput={Input}
        getInputRef={ref}
        type="text"
        {...props}
      />
    );
  }
);
PhoneInput.displayName = "PhoneInput";

// CEP Input
interface CEPInputProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const CEPInput = React.forwardRef<HTMLInputElement, CEPInputProps>(
  ({ value, onValueChange, ...props }, ref) => {
    return (
      <PatternFormat
        format="#####-###"
        mask="_"
        value={value}
        onValueChange={(values) => onValueChange(values.value)}
        customInput={Input}
        getInputRef={ref}
        type="text"
        {...props}
      />
    );
  }
);
CEPInput.displayName = "CEPInput";

// Currency Input (Brazilian Real)
interface CurrencyInputProps {
  value: string | number;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, ...props }, ref) => {
    return (
      <NumericFormat
        value={value}
        onValueChange={(values) => onValueChange(values.value)}
        thousandSeparator="."
        decimalSeparator=","
        prefix="R$ "
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        customInput={Input}
        getInputRef={ref}
        type="text"
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

// Percentage Input
interface PercentageInputProps {
  value: string | number;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export const PercentageInput = React.forwardRef<HTMLInputElement, PercentageInputProps>(
  ({ value, onValueChange, ...props }, ref) => {
    return (
      <NumericFormat
        value={value}
        onValueChange={(values) => onValueChange(values.value)}
        suffix="%"
        decimalScale={0}
        allowNegative={false}
        isAllowed={(values) => {
          const { floatValue } = values;
          return floatValue === undefined || floatValue <= 100;
        }}
        customInput={Input}
        getInputRef={ref}
        type="text"
        {...props}
      />
    );
  }
);
PercentageInput.displayName = "PercentageInput";

// Auto-add "9" prefix to mobile numbers (Brazilian standard)
// If the user types 8 digits after DDD (10 total), auto-inserts "9" to make it 11 digits
export const autoAddMobileNine = (digits: string): string => {
  const cleaned = digits.replace(/\D/g, "");
  // If 10 digits (DDD + 8 digit number), and 3rd digit is NOT 9, add 9
  if (cleaned.length === 10) {
    const thirdDigit = cleaned[2];
    // Only add 9 if it looks like a mobile (starts with 6,7,8,9 after DDD)
    if (["6", "7", "8"].includes(thirdDigit)) {
      return cleaned.slice(0, 2) + "9" + cleaned.slice(2);
    }
  }
  return cleaned;
};

// Format functions for display
export const formatCNPJ = (cnpj: string) => {
  if (!cnpj) return '';
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const formatPhone = (phone: string) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');

  // Com DDD
  if (cleaned.length === 11) {
    // Celular: (11) 91234-5678
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  if (cleaned.length === 10) {
    // Fixo: (11) 1234-5678
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  // Sem DDD (fallback)
  if (cleaned.length === 9) {
    return cleaned.replace(/(\d{5})(\d{4})/, '$1-$2');
  }
  if (cleaned.length === 8) {
    return cleaned.replace(/(\d{4})(\d{4})/, '$1-$2');
  }

  // Se vier em formato inesperado, não “quebra” a UI
  return cleaned;
};

export const formatCEP = (cep: string) => {
  if (!cep) return '';
  const cleaned = cep.replace(/\D/g, '');
  return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2');
};

export const formatCurrency = (value: number | string) => {
  if (!value) return 'R$ 0,00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numValue);
};

// Calculate annualized value based on billing type
// For "recorrente": (monthly * 12) + implementation
// For "pontual": monthly value as single payment (one-time, no multiplication)
export const calculateAnnualizedValue = (
  monthlyValue?: number | null, 
  implementationValue?: number | null,
  billingType?: string | null
): number => {
  const monthly = monthlyValue || 0;
  const implementation = implementationValue || 0;
  
  if (billingType === 'pontual') {
    // Pontual: monthly value is the one-time payment (no multiplication)
    return monthly + implementation;
  }
  
  // Recorrente (default): (monthly * 12) + implementation
  return (monthly * 12) + implementation;
};

export const formatAnnualizedValue = (
  monthlyValue?: number | null, 
  implementationValue?: number | null,
  billingType?: string | null
): string => {
  const annualized = calculateAnnualizedValue(monthlyValue, implementationValue, billingType);
  return formatCurrency(annualized);
};