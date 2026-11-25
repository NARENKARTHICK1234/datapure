"""Generate a 500,000-row unclean synthetic customer dataset with realistic data quality issues."""

import random
import string
import csv
import os
from datetime import datetime, timedelta

random.seed(99)

FIRST_NAMES = ["Aarav","Aditi","Aisha","Akash","Amelia","Ananya","Arjun","Ava","Ayaan","Bella",
               "Carlos","Charlotte","David","Deepa","Elena","Emma","Ethan","Fatima","Gabriel","Grace",
               "Harper","Isabella","James","Kavya","Liam","Lila","Luna","Maya","Miguel","Mia",
               "Mohammed","Nathan","Noor","Olivia","Priya","Rahul","Riya","Rohan","Sahana","Sana",
               "Sanjay","Sara","Shreya","Sophia","Tanvi","Thomas","Usha","Vikram","William","Zara"]

LAST_NAMES = ["Anderson","Bose","Brown","Chandra","Clark","Das","Davis","Desai","Garcia","Gupta",
              "Hall","Harris","Jackson","Johnson","Jones","Kim","Kumar","Lee","Martin","Martinez",
              "Miller","Moore","Nair","Patel","Perez","Pillai","Rao","Rodriguez","Sharma","Singh",
              "Smith","Taylor","Thomas","Thompson","Wang","White","Williams","Wilson","Yadav","Young"]

CITIES = ["Mumbai","Delhi","Bangalore","Chennai","Hyderabad","Pune","Kolkata","Ahmedabad",
          "New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio",
          "San Diego","Dallas","San Jose","Austin","Jacksonville","London","Manchester","Birmingham",
          "Dubai","Singapore","Sydney","Melbourne","Toronto","Vancouver","Berlin"]

STATES = ["MH","DL","KA","TN","TS","MH","WB","GJ","NY","CA","IL","TX","AZ","PA","TX",
          "CA","TX","CA","TX","FL","UK","UK","UK","UAE","SG","NSW","VIC","ON","BC","DE"]

PRODUCTS = ["Electronics","Apparel","Books","Home & Garden","Sports","Health & Beauty",
            "Toys","Food & Beverages","Automotive","Jewelry","ELECTRONICS","APPAREL",
            "BOOKS","HOME & GARDEN","SPORTS","health & beauty","toys","food & beverages"]

PAYMENT = ["Credit Card","Debit Card","PayPal","Bank Transfer","Apple Pay","Google Pay",
           "Cash","UPI","Net Banking","credit card","DEBIT CARD","paypal"]

STATUS = ["Active","Inactive","Suspended","active","ACTIVE","inactive","INACTIVE","suspended",""]

EMAILS_DOMAINS = ["gmail.com","yahoo.com","hotmail.com","company.io","outlook.com","icloud.com"]

DATE_FORMATS = [
    lambda d: d.strftime("%Y-%m-%d"),
    lambda d: d.strftime("%m/%d/%Y"),
    lambda d: d.strftime("%d-%m-%Y"),
    lambda d: d.strftime("%Y/%m/%d"),
    lambda d: d.strftime("%d %b %Y"),
    lambda d: d.strftime("%B %d, %Y"),
]

def random_date():
    start = datetime(2018, 1, 1)
    return start + timedelta(days=random.randint(0, 2800))

def make_email(first, last, dirty=False):
    if dirty and random.random() < 0.08:
        return f"{first.lower()}.{last.lower()}_invalid_email"   # missing @domain
    if dirty and random.random() < 0.05:
        return f"{first.lower()}@"                                # incomplete
    domain = random.choice(EMAILS_DOMAINS)
    num = random.randint(1, 999)
    return f"{first.lower()}.{last.lower()}{num}@{domain}"

def make_phone(dirty=False):
    if dirty and random.random() < 0.10:
        return str(random.randint(1000000000, 9999999999))        # no formatting
    if dirty and random.random() < 0.07:
        return "000-000-0000"                                     # fake placeholder
    if dirty and random.random() < 0.05:
        return ""                                                  # missing
    formats = [
        f"+1-{random.randint(200,999)}-{random.randint(200,999)}-{random.randint(1000,9999)}",
        f"{random.randint(200,999)}.{random.randint(200,999)}.{random.randint(1000,9999)}",
        f"({random.randint(200,999)}) {random.randint(200,999)}-{random.randint(1000,9999)}",
        f"{random.randint(2000000000,9999999999)}",
    ]
    return random.choice(formats)

def make_name(first, last, dirty=False):
    full = f"{first} {last}"
    if dirty and random.random() < 0.08:
        return full.upper()
    if dirty and random.random() < 0.08:
        return full.lower()
    if dirty and random.random() < 0.05:
        return f"  {full}  "    # extra whitespace
    return full

def make_age(dirty=False):
    if dirty and random.random() < 0.06:
        return random.choice([-5, 0, 150, 200, 999, "N/A", "unknown", ""])
    if dirty and random.random() < 0.04:
        return random.randint(150, 300)   # impossible age
    return random.randint(18, 75)

def make_purchase(dirty=False):
    if dirty and random.random() < 0.05:
        return random.choice([-999.99, -1, 0, 999999.99, "N/A", ""])
    if dirty and random.random() < 0.04:
        return random.uniform(5000, 50000)   # outlier
    return round(random.uniform(10, 2000), 2)

def generate_row(i, dirty=True):
    first = random.choice(FIRST_NAMES)
    last  = random.choice(LAST_NAMES)
    idx   = i % len(CITIES)

    cust_id = f"CUST-{10000 + i}"
    name    = make_name(first, last, dirty)
    age     = make_age(dirty)
    gender  = random.choice(["Male","Female","male","female","MALE","FEMALE","M","F","Other",""])
    email   = make_email(first, last, dirty)
    phone   = make_phone(dirty)
    city    = random.choice(CITIES) if not (dirty and random.random()<0.03) else ""
    state   = STATES[idx % len(STATES)]
    reg_date_obj = random_date()
    reg_date = random.choice(DATE_FORMATS)(reg_date_obj)
    purchase = make_purchase(dirty)
    product  = random.choice(PRODUCTS)
    payment  = random.choice(PAYMENT)
    status   = random.choice(STATUS)

    # Inject missing values randomly
    if dirty:
        row = [cust_id, name, age, gender, email, phone, city, state, reg_date, purchase, product, payment, status]
        for j in range(len(row)):
            if random.random() < 0.04:
                row[j] = ""
        return row

    return [cust_id, name, age, gender, email, phone, city, state, reg_date, purchase, product, payment, status]

# ----- Generate -----
TOTAL = 500_000
DUPLICATE_RATE = 0.05   # 5% duplicates = ~25,000 duplicate rows

out_path = r"C:\Users\Dell\OneDrive\Desktop\INTERNSHIP PROJECT 1\unclean_data_500k.csv"

print(f"Generating {TOTAL:,} rows of unclean data...")
headers = ["CustomerID","FullName","Age","Gender","Email","Phone","City","State",
           "RegistrationDate","PurchaseAmount","ProductCategory","PaymentMethod","CustomerStatus"]

buffer = []
with open(out_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(headers)
    
    base_rows = []
    real_count = int(TOTAL * (1 - DUPLICATE_RATE))
    dup_count  = TOTAL - real_count
    
    print(f"  Writing {real_count:,} unique rows...")
    for i in range(real_count):
        row = generate_row(i, dirty=True)
        base_rows.append(row)
        writer.writerow(row)
        if (i+1) % 100000 == 0:
            print(f"  ... {i+1:,} rows written")
    
    print(f"  Injecting {dup_count:,} duplicate rows...")
    dup_rows = random.choices(base_rows[:min(50000, len(base_rows))], k=dup_count)
    for row in dup_rows:
        writer.writerow(row)

print(f"\nDone! File saved to:\n  {out_path}")
size_mb = os.path.getsize(out_path) / (1024*1024)
print(f"  File size: {size_mb:.1f} MB")
print(f"  Total rows: {TOTAL:,} (including ~{dup_count:,} duplicates)")
