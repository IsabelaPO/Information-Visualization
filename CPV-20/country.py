import pandas as pd
import pycountry

# Load your CSV
df = pd.read_csv("streaming_platforms.csv")

# Column to convert
country_col = "production_countries"
country_new = "country_full_name"

# --- 1. Remove rows with invalid codes ---
invalid_codes = {"XC", "XK", "YU", "SU", "XC"}

# Drop rows containing any of the invalid codes (comma- or semicolon-separated)
df = df[~df[country_col].astype(str).apply(
    lambda x: any(code in x.replace(";", ",").split(",") for code in invalid_codes)
)]

# --- 2. Function to map codes to full country names ---
def codes_to_countries(codes):
    if pd.isna(codes):
        return codes
    full_names = []
    for code in codes.replace(";", ",").split(","):
        code = code.strip()
        country = pycountry.countries.get(alpha_2=code.upper())
        name = country.name if country else code
        # fix for "Viet Nam"
        if name == "Viet Nam":
            name = "Vietnam"
        full_names.append(name)
    return ", ".join(full_names)

# Apply conversion
df[country_new] = df[country_col].apply(codes_to_countries)

# Save result
df.to_csv("streaming_platforms.csv", index=False)

print("✅ Done! Converted all country codes in 'production_countries' to full names and removed invalid codes.")
