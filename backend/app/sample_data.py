"""Reproducible synthetic customer dataset generator (5,000 records) with realistic data quality issues."""

from __future__ import annotations

from datetime import datetime, timedelta
import numpy as np
import pandas as pd


FIRST_NAMES = [
    "Aarav", "Sophia", "Liam", "Olivia", "Noah", "Emma", "Ethan", "Ava",
    "Mason", "Isabella", "Lucas", "Mia", "Elijah", "Charlotte", "Logan", "Amelia",
    "James", "Harper", "Benjamin", "Evelyn", "Daniel", "Abigail", "Henry", "Emily",
    "Sebastian", "Elizabeth", "Jack", "Sofia", "Owen", "Avery", "Priya", "Rohan",
    "Maya", "Zara", "Caleb", "Chloe", "Nathan", "Grace", "Leo", "Hannah",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "Patel", "Sharma", "Kim", "Chen", "Walker", "Hall", "Young",
]

CITIES_STATES = [
    ("New York", "NY"), ("Los Angeles", "CA"), ("Chicago", "IL"), ("Houston", "TX"),
    ("Phoenix", "AZ"), ("Philadelphia", "PA"), ("San Antonio", "TX"), ("San Diego", "CA"),
    ("Dallas", "TX"), ("Austin", "TX"), ("San Jose", "CA"), ("Seattle", "WA"),
    ("Denver", "CO"), ("Boston", "MA"), ("Atlanta", "GA"), ("Miami", "FL"),
]

CATEGORIES = ["Electronics", "Apparel", "Home & Kitchen", "Health & Beauty", "Sports", "Books"]
PAYMENTS = ["Credit Card", "Debit Card", "PayPal", "Apple Pay", "Bank Transfer"]
STATUSES = ["Active", "Inactive", "Pending", "VIP"]
GENDERS = ["Male", "Female", "Non-Binary"]
DOMAINS = ["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "company.io"]


def generate_synthetic_customer_dataset(n_total: int = 5000, seed: int = 42) -> pd.DataFrame:
    """
    Generate a reproducible synthetic customer dataset with exactly 5,000 records.
    Clearly synthetic data containing intentional duplicates, missing values, invalid
    ages/emails/phones/dates, mixed types, inconsistent casing/dates/whitespace, and outliers.
    """
    rng = np.random.default_rng(seed)

    # Reserve 220 slots for duplicates and 15 slots for empty rows -> 4,765 base records
    n_empty = 15
    n_dups = 220
    n_base = n_total - n_empty - n_dups

    start_date = datetime(2022, 1, 1)
    records: list[dict] = []

    for i in range(n_base):
        cid = f"CUST-{10001 + i}"
        fname = FIRST_NAMES[int(rng.integers(0, len(FIRST_NAMES)))]
        lname = LAST_NAMES[int(rng.integers(0, len(LAST_NAMES)))]
        full_name = f"{fname} {lname}"

        age: object = int(np.clip(rng.normal(37, 12), 18, 82))
        gender: object = GENDERS[int(rng.choice([0, 1, 2], p=[0.47, 0.48, 0.05]))]
        domain = DOMAINS[int(rng.integers(0, len(DOMAINS)))]
        email: object = f"{fname.lower()}.{lname.lower()}{int(rng.integers(1, 999))}@{domain}"

        area = int(rng.integers(201, 989))
        mid = int(rng.integers(200, 999))
        end = int(rng.integers(1000, 9999))
        phone: object = f"+1-{area}-{mid}-{end}"

        city, state = CITIES_STATES[int(rng.integers(0, len(CITIES_STATES)))]
        reg_dt = start_date + timedelta(days=int(rng.integers(0, 1400)))
        reg_date: object = reg_dt.strftime("%Y-%m-%d")

        amount: object = round(float(np.clip(rng.lognormal(mean=4.8, sigma=0.65), 12.0, 950.0)), 2)
        category: object = CATEGORIES[int(rng.integers(0, len(CATEGORIES)))]
        payment: object = PAYMENTS[int(rng.integers(0, len(PAYMENTS)))]
        status: object = STATUSES[int(rng.choice([0, 1, 2, 3], p=[0.62, 0.16, 0.12, 0.10]))]

        # Inject realistic data quality defects
        # 1. Missing values (~4-7% across various fields)
        if rng.random() < 0.045:
            age = None
        if rng.random() < 0.055:
            email = None
        if rng.random() < 0.06:
            phone = None
        if rng.random() < 0.035:
            city = None
        if rng.random() < 0.03:
            state = None
        if rng.random() < 0.04:
            amount = None
        if rng.random() < 0.03:
            gender = None
        if rng.random() < 0.025:
            reg_date = None
        if rng.random() < 0.02:
            category = None

        # 2. Invalid ages and mixed types
        r_age = rng.random()
        if age is not None:
            if r_age < 0.012:
                age = int(rng.choice([-4, -12, 0, 155, 210, 999]))
            elif r_age < 0.020:
                age = rng.choice(["unknown", "N/A", "thirty"])

        # 3. Invalid email addresses & messy formatting
        if email is not None:
            r_email = rng.random()
            if r_email < 0.025:
                email = f"{fname.lower()}.{lname.lower()}_invalid_email"
            elif r_email < 0.040:
                email = f"{fname.lower()}@@{domain}"
            elif r_email < 0.052:
                email = f" {fname.upper()}.{lname.upper()}@{domain.upper()} "

        # 4. Incorrect & inconsistent phone numbers
        if phone is not None:
            r_phone = rng.random()
            if r_phone < 0.025:
                phone = str(int(rng.integers(100, 99999)))  # too short
            elif r_phone < 0.038:
                phone = "555-CALL-NOW"
            elif r_phone < 0.18:
                phone = f"({area}) {mid}-{end}"
            elif r_phone < 0.28:
                phone = f"{area}.{mid}.{end}"
            elif r_phone < 0.36:
                phone = f"{area}{mid}{end}"

        # 5. Inconsistent date formats & invalid dates
        if reg_date is not None:
            r_dt = rng.random()
            if r_dt < 0.012:
                reg_date = rng.choice(["2024-13-45", "invalid-date", "99/99/9999"])
            elif r_dt < 0.22:
                reg_date = reg_dt.strftime("%m/%d/%Y")
            elif r_dt < 0.36:
                reg_date = reg_dt.strftime("%d-%b-%Y")
            elif r_dt < 0.46:
                reg_date = reg_dt.strftime("%Y/%m/%d")

        # 6. Extra whitespace & inconsistent capitalization
        if rng.random() < 0.09:
            full_name = f"  {fname}   {lname}  "
        if rng.random() < 0.06:
            full_name = full_name.lower() if rng.random() < 0.5 else full_name.upper()

        if gender is not None and rng.random() < 0.14:
            gender = gender.lower() if rng.random() < 0.5 else gender.upper()

        if city is not None and rng.random() < 0.10:
            city = f" {city.lower()} " if rng.random() < 0.5 else city.upper()

        if category is not None and rng.random() < 0.12:
            category = category.lower() if rng.random() < 0.5 else category.upper()

        if status is not None and rng.random() < 0.12:
            status = status.lower() if rng.random() < 0.5 else status.upper()

        # 7. Numerical outliers & mixed currency strings in Purchase Amount
        if amount is not None:
            r_amt = rng.random()
            if r_amt < 0.018:
                amount = round(float(rng.uniform(4500.0, 28500.0)), 2)  # extreme high outliers
            elif r_amt < 0.025:
                amount = round(float(-rng.uniform(15.0, 250.0)), 2)  # invalid negative purchase
            elif r_amt < 0.040:
                amount = f"${amount:.2f}"  # mixed string type

        records.append(
            {
                "Customer ID": cid,
                "Full Name": full_name,
                "Age": age,
                "Gender": gender,
                "Email": email,
                "Phone Number": phone,
                "City": city,
                "State": state,
                "Registration Date": reg_date,
                "Purchase Amount": amount,
                "Product Category": category,
                "Payment Method": payment,
                "Customer Status": status,
            }
        )

    # Add exact duplicate rows sampled from base records
    dup_indices = rng.integers(0, len(records), size=n_dups)
    for idx in dup_indices:
        records.append(dict(records[int(idx)]))

    # Add completely empty rows
    empty_row = {col: None for col in records[0].keys()}
    for _ in range(n_empty):
        records.append(dict(empty_row))

    df = pd.DataFrame(records)
    # Shuffle deterministically so issues are spread naturally across the dataset
    df = df.sample(frac=1.0, random_state=seed).reset_index(drop=True)
    return df
