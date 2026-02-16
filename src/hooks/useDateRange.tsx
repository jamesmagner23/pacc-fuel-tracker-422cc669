import React, { createContext, useContext, useState } from "react";
import { DateRange } from "@/data/mockData";

interface DateRangeContextType {
  range: DateRange;
  setRange: (range: DateRange) => void;
}

const DateRangeContext = createContext<DateRangeContextType>({
  range: "month",
  setRange: () => {},
});

export const DateRangeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [range, setRange] = useState<DateRange>("month");
  return (
    <DateRangeContext.Provider value={{ range, setRange }}>
      {children}
    </DateRangeContext.Provider>
  );
};

export const useDateRange = () => useContext(DateRangeContext);
