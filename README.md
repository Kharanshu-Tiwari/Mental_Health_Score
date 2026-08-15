# MindGauge — Student Mental Health Analyzer

MindGauge estimates a student's mental health score (0–10) from their digital habits, academics, and lifestyle, using a machine learning model trained on a 5,000-student dataset. It's a full end-to-end project: data cleaning + EDA → model training → a FastAPI backend that serves predictions → a static HTML/CSS/JS frontend that consumes them.

**Live demo:** https://mental-health-score-2-11b2.onrender.com
**API:** https://mental-health-score-5bo6.onrender.com

> **Note:** Both the frontend and backend are hosted on Render's free tier, which spins down after periods of inactivity. If nobody has used the app recently, the **first assessment can take up to ~50 seconds** while the backend cold-starts — it's not stuck, it just needs a moment to wake up. Subsequent requests are fast.

> Built as an educational / portfolio project. Predictions are not a medical diagnosis.

---

## How it works

1. **Enter your data** — age, gender, country, academic level, social media habits, study/sleep/activity hours, and stress level.
2. **Machine learning analysis** — the form is validated client-side, then sent as JSON to the FastAPI backend.
3. **Get your prediction** — the backend runs the trained model and returns a mental health score, visualized as an animated gauge.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | FastAPI, Pydantic |
| ML | scikit-learn (Random Forest Regressor), pandas, joblib |
| Notebook | Jupyter / Google Colab |

## Project structure

```
.
├── index.html      # Landing page + assessment form
├── style.css        # Styling for the site
├── script.js         # Form validation, API calls, gauge animation
├── main.py            # FastAPI backend serving /predict
├── Mental_Health_Model.pkl                                 # Trained model (loaded by main.py)
└── Student_Social_Media_And_Mental_Health_Impact.ipynb      # Data cleaning, EDA, and model training
```

## Model

The model is trained in `Student_Social_Media_And_Mental_Health_Impact.ipynb`, covering:

- Data cleaning (duplicates, clipping unrealistic values)
- Exploratory data analysis (target distribution, correlations, outliers, skew)
- Grouping rare countries into an "Other" bucket
- A preprocessing pipeline (log-transform + scale for skewed features, ordinal encoding for stress level, one-hot encoding for categorical features)
- Baseline Linear Regression, followed by a tuned Random Forest Regressor (`RandomizedSearchCV`)
- The final pipeline is saved with `joblib` as `Mental_Health_Model.pkl`

## Running locally

### Backend

```bash
pip install fastapi uvicorn pandas scikit-learn joblib
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`, with interactive docs at `http://127.0.0.1:8000/docs`.

### Frontend

The frontend calls a deployed API URL by default (set in `script.js`). To point it at your local backend instead, update `API_URL` in `script.js`:

```js
const API_URL = "http://127.0.0.1:8000/predict";
```

Then simply open `index.html` in a browser, or serve the folder with any static server:

```bash
python -m http.server 5500
```

## API

**POST** `/predict`

Request body:

```json
{
  "Age": 21,
  "Gender": "Male",
  "Country": "India",
  "Academic_Level": "Undergraduate",
  "Most_Used_Platform": "Instagram",
  "Purpose_Of_Use": "Entertainment",
  "Avg_Daily_Usage_Hours": 5.5,
  "Daily_Unlocks": 80,
  "Study_Hours": 4,
  "Physical_Activity_Hours": 1,
  "Sleep_Hours_Per_Night": 6.5,
  "Stress_Level": "High"
}
```

Response:

```json
{
  "predicted_mental_health_score": 6.42
}
```

## Disclaimer

This tool is a machine learning demo built for educational and portfolio purposes. It is **not** a clinical or diagnostic instrument, and should not be used as a substitute for professional mental health advice.
