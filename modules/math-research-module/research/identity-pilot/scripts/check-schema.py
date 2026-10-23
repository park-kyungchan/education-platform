"""Independent standards-compliant structural validation. Semantic tests run in Node."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator
root = Path(__file__).resolve().parents[1]
schema = json.loads((root/'schemas/research-bundle.schema.json').read_text())
fixture = json.loads((root/'samples/research-bundle.json').read_text())
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)
validator.validate(fixture)
for name, mutate in [
 ('native permission', lambda b: b['authority'].update(nativePermissionGranted=True)),
 ('invalid ID', lambda b: b['revisions'][0].update(id='DATA/multiplication/grade3')),
 ('presentation statement override', lambda b: b['presentations'][0].update(statement='확정 진단')),
 ('full 105 diagnosis assertion', lambda b: b['coverage'].update(full105TypesDiagnosed=True)),
]:
    broken = json.loads(json.dumps(fixture)); mutate(broken)
    assert list(validator.iter_errors(broken)), f'negative case accepted: {name}'
print('JSON Schema Draft 2020-12: schema, positive fixture, and 4 negative cases passed')
