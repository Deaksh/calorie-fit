import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { defaultProfile } from '@caloriefit/shared';
import {
  activityOptions,
  eatingWindowOptions,
  fastingOptions,
  goalOptions,
  indiaStates,
  regionOptions,
  sexOptions
} from '@caloriefit/shared';
import {
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Location from 'expo-location';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'web' ? 'http://localhost:4000' : 'http://192.168.1.6:4000');

export default function App() {
  const [form, setForm] = useState({
    ...defaultProfile,
    age: String(defaultProfile.age),
    heightCm: String(defaultProfile.heightCm),
    weightKg: String(defaultProfile.weightKg),
    fastingHours: String(defaultProfile.fastingHours ?? ''),
    eatingWindowHours: String(defaultProfile.eatingWindowHours ?? '')
  });
  const [targets, setTargets] = useState(null);
  const [plan, setPlan] = useState('');
  const [mealText, setMealText] = useState('Medium size pizza at Domino\'s');
  const [mealEstimate, setMealEstimate] = useState(null);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingMeal, setLoadingMeal] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [cuisineHints, setCuisineHints] = useState([]);
  const [cuisineSpecialties, setCuisineSpecialties] = useState([]);
  const [locationNote, setLocationNote] = useState('');
  const [cuisineError, setCuisineError] = useState('');
  const [agentGoal, setAgentGoal] = useState('Build a weekly plan for lean muscle with intermittent fasting.');
  const [agentContext, setAgentContext] = useState('Train 4x/week, vegetarian on weekdays, prefers South Indian foods.');
  const [agentResult, setAgentResult] = useState(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const apiHint = useMemo(() => API_BASE_URL, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
      if (!response.ok) {
        setTargets({ error: data?.error || 'Failed to calculate targets' });
      } else {
        setTargets(data);
      }
    } catch (err) {
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
      if (!response.ok) {
        setPlan(data?.error || 'Failed to generate plan.');
      } else {
        setPlan(data.plan || 'No plan returned.');
      }
    } catch (err) {
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
      if (!response.ok) {
        setMealEstimate({ error: data?.error || 'Failed to estimate meal.' });
      } else {
        setMealEstimate(data);
      }
    } catch (err) {
      setMealEstimate({ error: err.message || 'Failed to estimate meal.' });
    } finally {
      setLoadingMeal(false);
    }
  };

  const detectLocation = async () => {
    setLoadingLocation(true);
    setLocationError('');
    setLocationNote('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied.');
        return;
      }

      const position =
        (await Location.getLastKnownPositionAsync()) ||
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }));

      const [place] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });

      if (!place) {
        setLocationNote(`Lat ${position.coords.latitude.toFixed(4)}, Lng ${position.coords.longitude.toFixed(4)}`);
        const fallback = await reverseGeocodeViaServer(position.coords.latitude, position.coords.longitude);
        if (fallback) {
          update('region', fallback.region || form.region);
          update('state', fallback.state || form.state);
          update('city', fallback.city || form.city);
        } else {
          setLocationError('Unable to resolve location. Please enter manually.');
        }
        return;
      }

      update('region', place.country || form.region);
      update('state', place.region || form.state);
      update('city', place.city || form.city);
      setLocationNote(`Lat ${position.coords.latitude.toFixed(4)}, Lng ${position.coords.longitude.toFixed(4)}`);
    } catch (err) {
      setLocationError(err.message || 'Location failed.');
    } finally {
      setLoadingLocation(false);
    }
  };

  const fetchCuisineHints = async (override) => {
    setCuisineError('');
    try {
      const payload = override || {
        region: form.region,
        state: form.state,
        city: form.city
      };
      const response = await fetch(`${API_BASE_URL}/api/region/cuisines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data.cuisines)) {
        setCuisineHints(data.cuisines);
        setCuisineSpecialties(Array.isArray(data.specialties) ? data.specialties : []);
      } else {
        setCuisineError(data?.error || 'Failed to fetch cuisines.');
      }
    } catch {
      setCuisineError('Failed to fetch cuisines.');
    }
  };

  const reverseGeocodeViaServer = async (lat, lon) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/region/reverse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon })
      });
      const data = await response.json();
      if (response.ok && data.location) {
        return data.location;
      }
    } catch {
      return null;
    }
    return null;
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
    } catch (err) {
      setAgentResult({ error: err.message || 'Agent failed.' });
    } finally {
      setLoadingAgent(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>CalorieFit</Text>
        <Text style={styles.subtitle}>Personalized nutrition + AI coach</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile</Text>
          <Field label="Age" value={form.age} onChange={(v) => update('age', v)} keyboardType="numeric" />
          <SelectField label="Sex" value={form.sex} onChange={(v) => update('sex', v)} options={sexOptions} />
          <Field label="Height (cm)" value={form.heightCm} onChange={(v) => update('heightCm', v)} keyboardType="numeric" />
          <Field label="Weight (kg)" value={form.weightKg} onChange={(v) => update('weightKg', v)} keyboardType="numeric" />
          <SelectField label="Activity" value={form.activityLevel} onChange={(v) => update('activityLevel', v)} options={activityOptions} />
          <SelectField label="Goal" value={form.goal} onChange={(v) => update('goal', v)} options={goalOptions} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fasting</Text>
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
          <ActionButton
            label={loadingLocation ? 'Detecting location...' : 'Use my location'}
            onPress={detectLocation}
            disabled={loadingLocation}
          />
          {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
          {locationNote ? <Text style={styles.hint}>Detected: {locationNote}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cuisine Suggestions</Text>
          <ActionButton label="Suggest cuisines" onPress={() => fetchCuisineHints()} />
          {cuisineHints.length ? (
            <View style={styles.outputBox}>
              <Text style={styles.outputText}>Cuisines: {cuisineHints.join(', ')}</Text>
              {cuisineSpecialties.length ? (
                <Text style={styles.outputText}>Local specialties: {cuisineSpecialties.join(', ')}</Text>
              ) : null}
            </View>
          ) : cuisineError ? (
            <Text style={styles.errorText}>{cuisineError}</Text>
          ) : (
            <Text style={styles.hint}>Set your region/state/city to get local cuisine ideas.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Targets</Text>
          <ActionButton label={loadingTargets ? 'Calculating...' : 'Calculate Targets'} onPress={calculateTargets} disabled={loadingTargets} />
          {targets && (
            <View style={styles.outputBox}>
              {'error' in targets ? (
                <Text style={styles.errorText}>{targets.error}</Text>
              ) : (
                <Text style={styles.outputText}>
                  {`BMR: ${targets.bmr} kcal\nTDEE: ${targets.tdee} kcal\nDaily Calories: ${targets.calories} kcal\nProtein: ${targets.macros?.protein_g} g\nCarbs: ${targets.macros?.carbs_g} g\nFat: ${targets.macros?.fat_g} g`}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>AI Plan</Text>
          <ActionButton label={loadingPlan ? 'Generating...' : 'Generate Plan'} onPress={generatePlan} disabled={loadingPlan} />
          {plan ? (
            <View style={styles.outputBox}>
              <Text style={styles.outputText}>{plan}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Meal Estimate</Text>
          <Field label="Meal description" value={mealText} onChange={setMealText} multiline />
          <ActionButton label={loadingMeal ? 'Estimating...' : 'Estimate Meal'} onPress={estimateMeal} disabled={loadingMeal} />
          {mealEstimate && (
            <View style={styles.outputBox}>
              {'error' in mealEstimate ? (
                <Text style={styles.errorText}>{mealEstimate.error}</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={styles.outputText}>
                    {`Total Calories: ${mealEstimate.total_calories}\nProtein: ${mealEstimate.total_protein_g} g\nCarbs: ${mealEstimate.total_carbs_g} g\nFat: ${mealEstimate.total_fat_g} g\nConfidence: ${mealEstimate.confidence}`}
                  </Text>
                  {Array.isArray(mealEstimate.items) ? (
                    <View style={styles.outputBox}>
                      {mealEstimate.items.map((item, idx) => (
                        <Text key={`${item.name}-${idx}`} style={styles.outputText}>
                          {`• ${item.name}${item.quantity ? ` (${item.quantity}${item.unit ? ` ${item.unit}` : ''})` : ''}: ${item.calories} kcal, P ${item.protein_g}g, C ${item.carbs_g}g, F ${item.fat_g}g`}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Agent</Text>
          <Field label="Goal" value={agentGoal} onChange={setAgentGoal} multiline />
          <Field label="Context" value={agentContext} onChange={setAgentContext} multiline />
          <ActionButton label={loadingAgent ? 'Running...' : 'Run Agent'} onPress={runAgent} disabled={loadingAgent} />
          {agentResult && (
            <View style={styles.outputBox}>
              {'error' in agentResult ? (
                <Text style={styles.errorText}>{agentResult.error}</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={styles.outputText}>{agentResult.summary}</Text>
                  {Array.isArray(agentResult.steps) && agentResult.steps.length ? (
                    <View>
                      <Text style={styles.label}>Steps</Text>
                      {agentResult.steps.map((step, idx) => (
                        <Text key={`step-${idx}`} style={styles.outputText}>{`• ${step}`}</Text>
                      ))}
                    </View>
                  ) : null}
                  {Array.isArray(agentResult.questions) && agentResult.questions.length ? (
                    <View>
                      <Text style={styles.label}>Questions</Text>
                      {agentResult.questions.map((q, idx) => (
                        <Text key={`q-${idx}`} style={styles.outputText}>{`• ${q}`}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          )}
        </View>

        <Text style={styles.hint}>API base: {apiHint}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, keyboardType = 'default', multiline = false }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

function ActionButton({ label, onPress, disabled }) {
  return (
    <TouchableOpacity style={[styles.button, disabled && styles.buttonDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.selectWrapper}>
        <Picker selectedValue={value} onValueChange={onChange} style={styles.select}>
          {options.map((option) => (
            <Picker.Item key={option} label={String(option)} value={String(option)} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F7F3E9'
  },
  container: {
    padding: 20,
    gap: 16
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1C2A1A'
  },
  subtitle: {
    fontSize: 16,
    color: '#4E5A4B'
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    gap: 12
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C2A1A'
  },
  field: {
    gap: 6
  },
  label: {
    fontSize: 13,
    color: '#667065'
  },
  input: {
    backgroundColor: '#F2EEE3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    color: '#1C2A1A'
  },
  selectWrapper: {
    backgroundColor: '#F2EEE3',
    borderRadius: 10,
    overflow: 'hidden'
  },
  select: {
    color: '#1C2A1A'
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top'
  },
  button: {
    backgroundColor: '#1C2A1A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#F7F3E9',
    fontWeight: '600'
  },
  outputBox: {
    backgroundColor: '#F9F6EF',
    borderRadius: 10,
    padding: 12
  },
  outputText: {
    color: '#243322',
    lineHeight: 20
  },
  errorText: {
    color: '#8B2E2E'
  },
  hint: {
    fontSize: 12,
    color: '#7A8677',
    marginBottom: 40
  }
});
