#!/usr/bin/env python3
"""Independent JSON Schema checks. Install requirements-validation.txt first."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator
ROOT=Path(__file__).resolve().parents[1]
CTX=ROOT/'context/user-context'
for schema_name, document in [('sources','sources/source-excerpts.json'),('records','records.json'),('verification','verification.json')]:
    schema=json.loads((CTX/f'schemas/{schema_name}.schema.json').read_text())
    Draft202012Validator.check_schema(schema)
    Draft202012Validator(schema).validate(json.loads((CTX/document).read_text()))
print('PASS 3 user-context JSON Schemas and their instances')
exec(compile((ROOT/'research/identity-pilot/scripts/check-schema.py').read_text(),str(ROOT/'research/identity-pilot/scripts/check-schema.py'),'exec'),{'__file__':str(ROOT/'research/identity-pilot/scripts/check-schema.py'),'__name__':'__main__'})
