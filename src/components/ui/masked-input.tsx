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

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onValueChange, ...props }, ref) => {
    return (
      <PatternFormat
        format="(##) #####-####"
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

// Format functions for display
export const formatCNPJ = (cnpj: string) => {
  if (!cnpj) return '';
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

export const formatPhone = (phone: string) => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
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