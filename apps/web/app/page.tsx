'use client';

import { useMemo, useState } from 'react';
import type { CuisineResponse, MealEstimate, TargetsResponse } from '@caloriefit/shared';
import {
  activityOptions,
  defaultProfile,
  eatingWindowOptions,
  fastingOptions,
  goalOptions,
  indiaStates,
  regionOptions,
  sexOptions
} from '@caloriefit/shared';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== 'undefined' ? 'http://localhost:4000' : 'http://localhost:4000');

export default function HomePage() {
  const [form, setForm] = useState(() => ({
    ...defaultProfile,
    age: String(defaultProfile.age),
    heightCm: String(defaultProfile.heightCm),
    weightKg: String(defaultProfile.weightKg),
    fastingHours: String(defaultProfile.fastingHours ?? ''),
    eatingWindowHours: String(defaultProfile.eatingWindowHours ?? '')
  }));
  const [targets, setTargets] = useState<TargetsResponse | { error: string } | null>(null);
  const [plan, setPlan] = useState('');
  const [mealText, setMealText] = useState("4 obattu, 150 gm rice, 150 gm green grapes");
  const [mealEstimate, setMealEstimate] = useState<MealEstimate | { error: string } | null>(null);
  const [cuisineHints, setCuisineHints] = useState<CuisineResponse['cuisines']>([]);
  const [cuisineSpecialties, setCuisineSpecialties] = useState<CuisineResponse['specialties']>([]);
  const [cuisineError, setCuisineError] = useState('');
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingMeal, setLoadingMeal] = useState(false);
  const [agentGoal, setAgentGoal] = useState('Build a weekly plan for lean muscle with intermittent fasting.');
  const [agentContext, setAgentContext] = useState('Train 4x/week, vegetarian on weekdays, prefers South Indian foods.');
  const [agentResult, setAgentResult] = useState<{ summary: string; steps: string[]; questions: string[]; meal_plan?: string[] } | { error: string } | null>(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationNote, setLocationNote] = useState('');

  const apiHint = useMemo(() => API_BASE_URL, []);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const calculateTargets = async () => {
    setLoadingTargets(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age: form.age,
          sex: form.sex,
          heightCm: form.heightCm,
          weightKg: form.weightKg,
          activityLevel: form.activityLevel,
          goal: form.goal
        })
      });
      const data = await response.json();
      setTargets(response.ok ? (data as TargetsResponse) : { error: data?.error || 'Failed to calculate targets' });
    } catch (err: any) {
      setTargets({ error: err.message || 'Failed to calculate targets' });
    } finally {
      setLoadingTargets(false);
    }
  };

  const generatePlan = async () => {
    setLoadingPlan(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          age: Number(form.age),
          heightCm: Number(form.heightCm),
          weightKg: Number(form.weightKg)
        })
      });
      const data = await response.json();
      setPlan(response.ok ? data.plan || 'No plan returned.' : data?.error || 'Failed to generate plan.');
    } catch (err: any) {
      setPlan(err.message || 'Failed to generate plan.');
    } finally {
      setLoadingPlan(false);
    }
  };

  const estimateMeal = async () => {
    setLoadingMeal(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/meal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: mealText })
      });
      const data = await response.json();
      setMealEstimate(response.ok ? (data as MealEstimate) : { error: data?.error || 'Failed to estimate meal.' });
    } catch (err: any) {
      setMealEstimate({ error: err.message || 'Failed to estimate meal.' });
    } finally {
      setLoadingMeal(false);
    }
  };

  const fetchCuisineHints = async () => {
    setCuisineError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/region/cuisines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: form.region,
          state: form.state,
          city: form.city
        })
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data.cuisines)) {
        setCuisineHints((data as CuisineResponse).cuisines);
        setCuisineSpecialties(Array.isArray((data as CuisineResponse).specialties) ? (data as CuisineResponse).specialties : []);
      } else {
        setCuisineError(data?.error || 'Failed to fetch cuisines.');
      }
    } catch {
      setCuisineError('Failed to fetch cuisines.');
    }
  };

  const detectLocation = async () => {
    setLoadingLocation(true);
    setLocationError('');
    setLocationNote('');
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation not supported in this browser.');
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocationNote(`Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)}`);
        try {
          const response = await fetch(`${API_BASE_URL}/api/region/reverse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: latitude, lon: longitude })
          });
          const data = await response.json();
          if (response.ok && data.location) {
            update('region', data.location.region || form.region);
            update('state', data.location.state || form.state);
            update('city', data.location.city || form.city);
          } else {
            setLocationError('Unable to resolve location. Please enter manually.');
          }
        } catch {
          setLocationError('Unable to resolve location. Please enter manually.');
        } finally {
          setLoadingLocation(false);
        }
      },
      () => {
        setLocationError('Location permission denied or unavailable.');
        setLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const runAgent = async () => {
    setLoadingAgent(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: agentGoal, context: agentContext })
      });
      const data = await response.json();
      if (response.ok) {
        setAgentResult(data);
        if (Array.isArray(data.meal_plan) && data.meal_plan.length) {
          setMealText(data.meal_plan.join(', '));
        }
      } else {
        setAgentResult({ error: data?.error || 'Agent failed.' });
      }
    } catch (err: any) {
      setAgentResult({ error: err.message || 'Agent failed.' });
    } finally {
      setLoadingAgent(false);
    }
  };

  return (
    <main className="min-h-screen bg-sand-50 text-forest-800">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight">CalorieFit</h1>
          <p className="mt-2 text-sage-600">Personalized nutrition + AI coach</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-6">
            <Card title="Profile">
              <Field label="Age" value={form.age} onChange={(v) => update('age', v)} />
              <SelectField label="Sex" value={form.sex} onChange={(v) => update('sex', v)} options={sexOptions} />
              <Field label="Height (cm)" value={form.heightCm} onChange={(v) => update('heightCm', v)} />
              <Field label="Weight (kg)" value={form.weightKg} onChange={(v) => update('weightKg', v)} />
              <SelectField label="Activity" value={form.activityLevel} onChange={(v) => update('activityLevel', v)} options={activityOptions} />
              <SelectField label="Goal" value={form.goal} onChange={(v) => update('goal', v)} options={goalOptions} />
            </Card>

            <Card title="Fasting">
              <SelectField label="Fasting hours" value={form.fastingHours} onChange={(v) => update('fastingHours', v)} options={fastingOptions} />
              <SelectField label="Eating window hours" value={form.eatingWindowHours} onChange={(v) => update('eatingWindowHours', v)} options={eatingWindowOptions} />
              <Field label="Eating window start (HH:MM)" value={form.eatingWindowStart} onChange={(v) => update('eatingWindowStart', v)} />
              <Field label="Eating window end (HH:MM)" value={form.eatingWindowEnd} onChange={(v) => update('eatingWindowEnd', v)} />
              <Field label="Preferences" value={form.preferences} onChange={(v) => update('preferences', v)} multiline />
              <SelectField label="Country/Region" value={form.region} onChange={(v) => update('region', v)} options={regionOptions} />
              {form.region === 'India' ? (
                <SelectField label="State" value={form.state} onChange={(v) => update('state', v)} options={indiaStates} />
              ) : (
                <Field label="State" value={form.state} onChange={(v) => update('state', v)} />
              )}
              <Field label="City" value={form.city} onChange={(v) => update('city', v)} />
              <button className="btn" onClick={detectLocation} disabled={loadingLocation}>
                {loadingLocation ? 'Detecting location...' : 'Use my location'}
              </button>
              {locationError ? <p className="text-sm text-red-600">{locationError}</p> : null}
              {locationNote ? <p className="text-xs text-sage-600">Detected: {locationNote}</p> : null}
            </Card>

            <Card title="Cuisine Suggestions">
              <button className="btn" onClick={fetchCuisineHints}>Suggest cuisines</button>
              {cuisineHints.length ? (
                <div className="rounded-2xl bg-white/70 p-4 shadow-soft">
                  <p className="text-sm text-sage-600">Cuisines</p>
                  <p className="font-medium">{cuisineHints.join(', ')}</p>
                  {cuisineSpecialties.length ? (
                    <>
                      <p className="mt-3 text-sm text-sage-600">Local specialties</p>
                      <p className="font-medium">{cuisineSpecialties.join(', ')}</p>
                    </>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-sage-600">{cuisineError || 'Set your region/state/city to get local cuisine ideas.'}</p>
              )}
            </Card>
          </section>

          <section className="space-y-6">
            <Card title="Targets">
              <button className="btn" onClick={calculateTargets} disabled={loadingTargets}>
                {loadingTargets ? 'Calculating...' : 'Calculate Targets'}
              </button>
              {targets && (
                <div className="rounded-2xl bg-white/70 p-4 shadow-soft">
                  {'error' in targets ? (
                    <p className="text-sm text-red-600">{targets.error}</p>
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm text-forest-700">
{`BMR: ${targets.bmr} kcal
TDEE: ${targets.tdee} kcal
Daily Calories: ${targets.calories} kcal
Protein: ${targets.macros?.protein_g} g
Carbs: ${targets.macros?.carbs_g} g
Fat: ${targets.macros?.fat_g} g`}
                    </pre>
                  )}
                </div>
              )}
            </Card>

            <Card title="AI Plan">
              <button className="btn" onClick={generatePlan} disabled={loadingPlan}>
                {loadingPlan ? 'Generating...' : 'Generate Plan'}
              </button>
              {plan ? (
                <div className="rounded-2xl bg-white/70 p-4 shadow-soft">
                  <p className="text-sm text-forest-700 whitespace-pre-wrap">{plan}</p>
                </div>
              ) : null}
            </Card>

            <Card title="Meal Estimate">
              <label className="text-sm text-sage-600">Meal description</label>
              <textarea
                className="input min-h-[90px]"
                value={mealText}
                onChange={(e) => setMealText(e.target.value)}
              />
              <button className="btn" onClick={estimateMeal} disabled={loadingMeal}>
                {loadingMeal ? 'Estimating...' : 'Estimate Meal'}
              </button>
              {mealEstimate && (
                <div className="rounded-2xl bg-white/70 p-4 shadow-soft">
                  {'error' in mealEstimate ? (
                    <p className="text-sm text-red-600">{mealEstimate.error}</p>
                  ) : (
                    <div className="space-y-3 text-sm text-forest-700">
                      <p>{`Total Calories: ${mealEstimate.total_calories}`}</p>
                      <p>{`Protein: ${mealEstimate.total_protein_g} g`}</p>
                      <p>{`Carbs: ${mealEstimate.total_carbs_g} g`}</p>
                      <p>{`Fat: ${mealEstimate.total_fat_g} g`}</p>
                      <p>{`Confidence: ${mealEstimate.confidence}`}</p>
                      {Array.isArray(mealEstimate.items) ? (
                        <div className="rounded-2xl bg-sand-100 p-3">
                          {mealEstimate.items.map((item: any, idx: number) => (
                            <p key={`${item.name}-${idx}`}>
                              {`• ${item.name}${item.quantity ? ` (${item.quantity}${item.unit ? ` ${item.unit}` : ''})` : ''}: ${item.calories} kcal, P ${item.protein_g}g, C ${item.carbs_g}g, F ${item.fat_g}g`}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </Card>

            <Card title="Agent">
              <label className="text-sm text-sage-600">Goal</label>
              <textarea className="input min-h-[90px] resize-y" value={agentGoal} onChange={(e) => setAgentGoal(e.target.value)} />
              <label className="text-sm text-sage-600">Context</label>
              <textarea className="input min-h-[90px] resize-y" value={agentContext} onChange={(e) => setAgentContext(e.target.value)} />
              <button className="btn" onClick={runAgent} disabled={loadingAgent}>
                {loadingAgent ? 'Running...' : 'Run Agent'}
              </button>
              {agentResult && (
                <div className="rounded-2xl bg-white/70 p-4 shadow-soft text-sm text-forest-700 space-y-2">
                  {'error' in agentResult ? (
                    <p className="text-red-600">{agentResult.error}</p>
                  ) : (
                    <>
                      <p className="font-medium">{agentResult.summary}</p>
                      {agentResult.steps?.length ? (
                        <div>
                          <p className="text-sage-600">Steps</p>
                          <ul className="list-disc pl-5">
                            {agentResult.steps.map((step, idx) => (
                              <li key={`step-${idx}`}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {agentResult.questions?.length ? (
                        <div>
                          <p className="text-sage-600">Questions</p>
                          <ul className="list-disc pl-5">
                            {agentResult.questions.map((q, idx) => (
                              <li key={`q-${idx}`}>{q}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              )}
            </Card>
          </section>
        </div>

        <p className="mt-10 text-xs text-sage-600">API base: {apiHint}</p>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-sand-100 p-6 shadow-soft">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-sage-600">
      {label}
      {multiline ? (
        <textarea className="input min-h-[80px] resize-y" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-sage-600">
      {label}
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
