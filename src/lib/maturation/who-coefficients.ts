// WHO BMI-for-age Z-score approximation for ages 5-19
// Based on WHO Reference 2007 (simplified LMS method)

import { Sex } from "@/lib/types";
import { roundHalf } from "@/lib/utils";

// Simplified LMS tables for BMI (Ages 5 to 19, half-year steps)
// L = Box-Cox power, M = Median, S = Coefficient of variation
// Z = (((BMI / M)^L) - 1) / (L * S)

const boysBmiLms = [
  { age: 5.0, L: -1.378, M: 15.3, S: 0.081 },
  { age: 5.5, L: -1.488, M: 15.3, S: 0.084 },
  { age: 6.0, L: -1.597, M: 15.3, S: 0.088 },
  { age: 6.5, L: -1.705, M: 15.4, S: 0.093 },
  { age: 7.0, L: -1.808, M: 15.5, S: 0.098 },
  { age: 7.5, L: -1.905, M: 15.6, S: 0.103 },
  { age: 8.0, L: -1.996, M: 15.7, S: 0.109 },
  { age: 8.5, L: -2.080, M: 15.9, S: 0.114 },
  { age: 9.0, L: -2.155, M: 16.1, S: 0.119 },
  { age: 9.5, L: -2.222, M: 16.4, S: 0.124 },
  { age: 10.0, L: -2.281, M: 16.7, S: 0.129 },
  { age: 10.5, L: -2.330, M: 17.0, S: 0.133 },
  { age: 11.0, L: -2.370, M: 17.3, S: 0.137 },
  { age: 11.5, L: -2.400, M: 17.7, S: 0.141 },
  { age: 12.0, L: -2.422, M: 18.1, S: 0.144 },
  { age: 12.5, L: -2.434, M: 18.5, S: 0.146 },
  { age: 13.0, L: -2.437, M: 18.9, S: 0.148 },
  { age: 13.5, L: -2.430, M: 19.3, S: 0.149 },
  { age: 14.0, L: -2.414, M: 19.8, S: 0.150 },
  { age: 14.5, L: -2.389, M: 20.2, S: 0.151 },
  { age: 15.0, L: -2.355, M: 20.6, S: 0.151 },
  { age: 15.5, L: -2.312, M: 21.0, S: 0.150 },
  { age: 16.0, L: -2.261, M: 21.3, S: 0.150 },
  { age: 16.5, L: -2.203, M: 21.6, S: 0.149 },
  { age: 17.0, L: -2.138, M: 21.9, S: 0.148 },
  { age: 17.5, L: -2.066, M: 22.2, S: 0.147 },
  { age: 18.0, L: -1.990, M: 22.4, S: 0.146 },
  { age: 18.5, L: -1.908, M: 22.6, S: 0.145 },
  { age: 19.0, L: -1.823, M: 22.8, S: 0.145 },
];

const girlsBmiLms = [
  { age: 5.0, L: -0.835, M: 15.3, S: 0.091 },
  { age: 5.5, L: -0.963, M: 15.3, S: 0.096 },
  { age: 6.0, L: -1.096, M: 15.3, S: 0.103 },
  { age: 6.5, L: -1.231, M: 15.4, S: 0.110 },
  { age: 7.0, L: -1.365, M: 15.5, S: 0.117 },
  { age: 7.5, L: -1.493, M: 15.7, S: 0.124 },
  { age: 8.0, L: -1.611, M: 15.9, S: 0.131 },
  { age: 8.5, L: -1.719, M: 16.2, S: 0.137 },
  { age: 9.0, L: -1.815, M: 16.5, S: 0.143 },
  { age: 9.5, L: -1.898, M: 16.8, S: 0.148 },
  { age: 10.0, L: -1.968, M: 17.2, S: 0.152 },
  { age: 10.5, L: -2.025, M: 17.6, S: 0.156 },
  { age: 11.0, L: -2.069, M: 18.0, S: 0.159 },
  { age: 11.5, L: -2.100, M: 18.4, S: 0.161 },
  { age: 12.0, L: -2.119, M: 18.8, S: 0.162 },
  { age: 12.5, L: -2.126, M: 19.2, S: 0.162 },
  { age: 13.0, L: -2.122, M: 19.6, S: 0.162 },
  { age: 13.5, L: -2.108, M: 20.0, S: 0.161 },
  { age: 14.0, L: -2.086, M: 20.3, S: 0.160 },
  { age: 14.5, L: -2.056, M: 20.6, S: 0.158 },
  { age: 15.0, L: -2.019, M: 20.9, S: 0.157 },
  { age: 15.5, L: -1.977, M: 21.1, S: 0.155 },
  { age: 16.0, L: -1.931, M: 21.3, S: 0.153 },
  { age: 16.5, L: -1.881, M: 21.5, S: 0.151 },
  { age: 17.0, L: -1.828, M: 21.6, S: 0.150 },
  { age: 17.5, L: -1.774, M: 21.7, S: 0.148 },
  { age: 18.0, L: -1.718, M: 21.8, S: 0.147 },
  { age: 18.5, L: -1.661, M: 21.9, S: 0.146 },
  { age: 19.0, L: -1.604, M: 22.0, S: 0.145 },
];

export function getWhoBmiZScore(age: number, sex: Sex, bmi: number): number | null {
  if (age < 5 || age > 19) return null;
  
  const targetAge = roundHalf(age);
  const table = sex === "male" ? boysBmiLms : girlsBmiLms;
  let entry = table[0];

  for (const row of table) {
    if (row.age <= targetAge) {
      entry = row;
    }
  }

  const { L, M, S } = entry;
  
  if (L === 0) {
    return Math.log(bmi / M) / S;
  }
  
  return (Math.pow(bmi / M, L) - 1) / (L * S);
}
