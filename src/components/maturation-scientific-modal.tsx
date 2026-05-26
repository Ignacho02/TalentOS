"use client";

import { X, ExternalLink } from "lucide-react";

interface MaturationScientificModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
  onCommunityClick?: () => void;
}

export function MaturationScientificModal({
  isOpen,
  onClose,
  t,
  onCommunityClick,
}: MaturationScientificModalProps) {
  if (!isOpen) return null;

  const handleCommunityClick = () => {
    onCommunityClick?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-line shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900">Respaldo Científico</h2>
            <p className="text-sm text-zinc-500 mt-1">
              Metodologías y evidencia en los cálculos madurativos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* Introduction */}
          <div className="rounded-xl bg-accent/5 border border-accent/20 p-4">
            <p className="text-sm text-zinc-700 leading-relaxed">
              La aplicación implementa múltiples métodos de cálculo de maduración biológica 
              basados en antropometría. Cada método está validado científicamente y contribuye 
              a una evaluación integral del estado madurativo del atleta.
            </p>
          </div>

          {/* Methods Grid */}
          <div className="space-y-5">
            {/* Khamis-Roche */}
            <div className="rounded-xl border border-zinc-200 p-4 hover:border-accent/40 transition">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700 font-bold text-sm">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-900">Khamis-Roche (1994)</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Predicción de Talla Adulta (PAH)</p>
                </div>
              </div>
              <p className="text-sm text-zinc-700 mb-3 leading-relaxed">
                Predice la altura adulta final del individuo usando regresión multivariada. 
                Requiere altura de padres, edad cronológica, talla y peso actuales.
              </p>
              <div className="bg-zinc-50 rounded-lg p-3 text-xs text-zinc-600 font-mono mb-3 overflow-x-auto">
                <div>PAH = β₀ + β₁×stature + β₂×weight + β₃×midParentStature</div>
                <div className="mt-1">%PAH = (current_stature / PAH) × 100</div>
              </div>
              <div className="text-xs text-zinc-600">
                <strong>Referencia:</strong> Khamis HJ, Roche AF. "Predicting adult stature without using 
                skeletal age." Pediatrics. 1994;94(4):504-507.
              </div>
            </div>

            {/* Mirwald */}
            <div className="rounded-xl border border-zinc-200 p-4 hover:border-accent/40 transition">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-700 font-bold text-sm">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-900">Mirwald et al. (2002)</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Maturity Offset — Edad del PHV</p>
                </div>
              </div>
              <p className="text-sm text-zinc-700 mb-3 leading-relaxed">
                Estima el offset de madurez (distancia del Pico de Velocidad de Altura - PHV) 
                usando medidas antropométricas simples. Aplica a ambos sexos con ecuaciones diferentes.
              </p>
              <div className="bg-zinc-50 rounded-lg p-3 text-xs text-zinc-600 font-mono mb-3 overflow-x-auto">
                <div>Mirwald Offset = f(leg_length, sitting_height, age, mass)</div>
                <div className="mt-1">APHV = age - offset (edad estimada del PHV)</div>
              </div>
              <div className="text-xs text-zinc-600">
                <strong>Referencia:</strong> Mirwald RL, et al. "An assessment of maturity from 
                anthropometric measurements." Med Sci Sports Exerc. 2002;34(4):689-694.
              </div>
            </div>

            {/* Moore */}
            <div className="rounded-xl border border-zinc-200 p-4 hover:border-accent/40 transition">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 text-orange-700 font-bold text-sm">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-900">Moore et al. (2015)</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Simplified Maturity Offset</p>
                </div>
              </div>
              <p className="text-sm text-zinc-700 mb-3 leading-relaxed">
                Versión simplificada del offset de Mirwald que usa solo una variable de interacción 
                (edad × altura sentada para chicos, edad × altura para chicas). Menos preciso pero más rápido.
              </p>
              <div className="bg-zinc-50 rounded-lg p-3 text-xs text-zinc-600 font-mono mb-3 overflow-x-auto">
                <div>Males: offset = -8.128741 + 0.0070346×(age×sitting_height)</div>
                <div className="mt-1">Females: offset = -7.709133 + 0.0042232×(age×stature)</div>
              </div>
              <div className="text-xs text-zinc-600">
                <strong>Referencia:</strong> Moore SA, et al. "Predicting age at peak height velocity." 
                J Sports Sci. 2015;33(11):1241-1247.
              </div>
            </div>

            {/* Fransen */}
            <div className="rounded-xl border border-zinc-200 p-4 hover:border-accent/40 transition">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 text-purple-700 font-bold text-sm">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-900">Fransen et al. (2018)</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Maturity Ratio (Chicos solo)</p>
                </div>
              </div>
              <p className="text-sm text-zinc-700 mb-3 leading-relaxed">
                Calcula un ratio de madurez polinómico de múltiples variables. Es el método más preciso 
                para chicos, pero solo disponible para el sexo masculino.
              </p>
              <div className="bg-zinc-50 rounded-lg p-3 text-xs text-zinc-600 font-mono mb-3 overflow-x-auto">
                <div>ratio = 6.987 + 0.116×age + 0.0015×age² + 0.0045×mass...</div>
                <div className="mt-1">APHV = age / ratio</div>
              </div>
              <div className="text-xs text-zinc-600">
                <strong>Referencia:</strong> Fransen J, et al. "Estimating peak height velocity from 
                anthropometric data." J Sports Sci. 2018;36(18):2067-2075.
              </div>
            </div>

            {/* Sherar */}
            <div className="rounded-xl border border-zinc-200 p-4 hover:border-accent/40 transition">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0 text-pink-700 font-bold text-sm">
                  5
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-900">Sherar et al. (2005)</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Offset Ajustado para Chicas</p>
                </div>
              </div>
              <p className="text-sm text-zinc-700 mb-3 leading-relaxed">
                Ajuste específico del maturity offset de Mirwald para atletas femeninas. Refleja 
                diferencias en el patrón madurativo entre sexos.
              </p>
              <div className="text-xs text-zinc-600">
                <strong>Referencia:</strong> Sherar LB, et al. "Adjustments to the Mirwald et al. 
                prediction equations for the assessment of maturity." Med Sci Sports Exerc. 2005;37(5):S127.
              </div>
            </div>

            {/* Derived Metrics */}
            <div className="rounded-xl border border-zinc-200 p-4 hover:border-accent/40 transition">
              <div className="flex items-start gap-3 mb-3">
                <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0 text-teal-700 font-bold text-sm">
                  ★
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-900">Métricas Derivadas</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Complementarias y contexto</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="text-zinc-700">
                  <strong>Sitting Height Ratio (SHR):</strong> Proporción de la talla sentada respecto 
                  a la talla total (%). Indicador de proporcionalidad corporal.
                </div>
                <div className="text-zinc-700">
                  <strong>WHO BMI Z-Score:</strong> Comparación del IMC contra curvas de crecimiento de 
                  la OMS por edad y sexo. Estándar internacional de referencia.
                </div>
                <div className="text-zinc-700">
                  <strong>PAH Band:</strong> Clasificación en bandas de porcentaje de talla adulta 
                  (&lt;85%, 85-90%, 90-95%, &gt;95%) para bio-banding.
                </div>
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="rounded-xl border border-zinc-200 p-4 bg-zinc-50">
            <h3 className="font-semibold text-zinc-900 mb-3">Clasificación en Bandas</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-teal-600 flex-shrink-0"></div>
                <div>
                  <strong className="text-zinc-900">Pre-PHV:</strong>
                  <span className="text-zinc-600 ml-2">Offset ≤ -1 años (antes del pico de crecimiento)</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-amber-600 flex-shrink-0"></div>
                <div>
                  <strong className="text-zinc-900">Mid-PHV:</strong>
                  <span className="text-zinc-600 ml-2">Offset entre -1 y +1 años (en el pico)</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-slate-900 flex-shrink-0"></div>
                <div>
                  <strong className="text-zinc-900">Post-PHV:</strong>
                  <span className="text-zinc-600 ml-2">Offset ≥ +1 años (después del pico)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Community CTA */}
          <div className="rounded-xl bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 p-5">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-zinc-900 mb-2">Formación Continua</h3>
                <p className="text-sm text-zinc-700 mb-3">
                  Accede a la comunidad para profundizar en la evidencia científica, compartir 
                  prácticas y conectar con otros profesionales del área.
                </p>
                <button
                  onClick={handleCommunityClick}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent text-white px-4 py-2 text-sm font-medium hover:bg-accent/90 transition"
                >
                  <span>Ir a Comunidad</span>
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-xs text-zinc-500 text-center py-2 border-t border-zinc-200">
            <p>
              Versión del algoritmo: 2026.04-excel-aligned-v1. 
              Todos los métodos están validados y calibrados según literatura científica reciente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
