import {describe,expect,test} from 'bun:test';
import {resolve} from 'node:path';
import {readInputRecord} from '../../apps/academy/dc-gang-a/src/contracts/readInputRecord';
import {readInputRecord as legacyReadInputRecord} from '../../apps/academy/dc-gang-a/src/lms/academyReadProtocol';
import {parentInternalLanguage} from '../../apps/academy/dc-gang-a/src/contracts/parentInternalLanguage';
import {parentInternalLanguage as legacyParentInternalLanguage} from '../../apps/academy/dc-gang-a/src/academy/teacherWorkspace';
import * as pure from '../../apps/academy/dc-gang-a/src/contracts/operationalContractShape';
import * as legacy from '../../apps/academy/dc-gang-a/src/academy/operationalContract';
import {catalogLevels} from '../../apps/academy/dc-gang-a/src/contracts/catalogLevels';
import {catalogLevels as legacyCatalogLevels} from '../../apps/academy/dc-gang-a/src/academy/domain';
import type {CatalogKind} from '../../apps/academy/dc-gang-a/src/contracts/catalogLevels';
import type {CatalogKind as LegacyCatalogKind} from '../../apps/academy/dc-gang-a/src/academy/domain';
import type {SourceDiscoveryRequest} from '../../apps/academy/dc-gang-a/src/contracts/sourceDiscovery';
import type {SourceDiscoveryRequest as LegacySourceDiscoveryRequest} from '../../apps/academy/dc-gang-a/src/academy/nativeBookSource';
import {queryEndpoints} from '../../apps/academy/dc-gang-a/src/lms/endpointCatalog';

describe('neutral contract compatibility without acquisition or business writes',()=>{
  test('record reader keeps one implementation and exact refusal codes at the old export',()=>{
    expect(legacyReadInputRecord).toBe(readInputRecord);
    for(const input of [null,undefined,[],true,1,'text'])expect(()=>legacyReadInputRecord(input)).toThrow(/^invalid_read_request$/);
    let reads=0;const input={get sensitive(){reads++;return 'synthetic';}};
    expect(()=>readInputRecord(input)).toThrow(/^accessor_read_request$/);expect(reads).toBe(0);
    const original=Object.create({inherited:'not copied'});Object.defineProperty(original,'hidden',{value:'synthetic',enumerable:false});
    expect(readInputRecord(original)).toEqual({hidden:'synthetic'});
    const shared={marker:'synthetic'};const result=readInputRecord({shared});expect(result.shared).toBe(shared);
    expect(readInputRecord(Object.create(null))).toEqual({});
  });
  test('parent exclusion safeguard is the same regex and preserves independent interpretation',()=>{
    expect(legacyParentInternalLanguage).toBe(parentInternalLanguage);
    expect(parentInternalLanguage.global).toBe(false);
    for(const line of ['teacher review','not completed','ungraded'])expect(parentInternalLanguage.test(line)).toBe(true);
    expect(parentInternalLanguage.test('Synthetic learning progress.')).toBe(false);
  });
  test('legacy shape exports share the exact object, catalog array and topic values',()=>{
    expect(legacy.operationalContractShape).toBe(pure.operationalContractShape);
    expect(legacy.OPERATIONAL_CONTRACT_PATH).toBe(pure.OPERATIONAL_CONTRACT_PATH);
    expect(legacy.OPERATIONAL_CONTRACT_REVISION).toBe(pure.OPERATIONAL_CONTRACT_REVISION);
    expect(legacy.operationalTopics).toBe(pure.operationalTopics);
    expect(legacyCatalogLevels).toBe(catalogLevels);
    expect(pure.operationalContractShape.product.contentHierarchy).toBe(catalogLevels);
    const contract=legacy.loadAcademyOperationalContract(resolve(import.meta.dir,'../../apps/academy/dc-gang-a'));
    expect(contract.product.contentHierarchy).toEqual(catalogLevels);
    expect(legacy.selectOperationalTopic(contract,'source_access').authorizesEffects).toBe(false);
    const changed=structuredClone(contract) as any;changed.sourceAccess.automaticBrowserFallback=true;
    expect(()=>legacy.validateAcademyOperationalContract(changed)).toThrow(/^invalid_operational_contract$/);
    expect(()=>legacy.selectOperationalTopic(contract,'unknown')).toThrow(/^invalid_operational_topic$/);
  });
  test('type compatibility retains selector readonly fields and catalog kind contracts',()=>{
    const selector:SourceDiscoveryRequest={teacherLabel:'synthetic',teacherKey:'1',collegeKey:'2',studentNames:['Synthetic'] as const};
    const legacySelector:LegacySourceDiscoveryRequest=selector;
    const roundTrip:SourceDiscoveryRequest=legacySelector;
    const kind:CatalogKind='learning_section';const legacyKind:LegacyCatalogKind=kind;
    expect(roundTrip).toBe(selector);expect(legacyKind).toBe(kind);
  });
  test('real catalog coverage consumes the pure policy with an explicit empty synthetic selection',()=>{
    // The existing injection boundary avoids fabricating the absent canonical registry.
    const result=queryEndpoints({projection:'coverage'},[]);
    expect(result.projection).toBe('coverage');
    if(result.projection!=='coverage')throw Error('coverage projection required');
    expect(result.coverage.readPreparation.requiredTransport).toBe(pure.operationalContractShape.sourceAccess.requiredTransport);
    expect(result.coverage.readPreparation.contractRef).toBe(pure.OPERATIONAL_CONTRACT_PATH);
    expect(result.coverage.readPreparation.directClientQualification).toBe(pure.operationalContractShape.sourceAccess.directClientQualification);
    expect(result.coverage.executionEnabled).toBe(false);
    expect(result.coverage.physicalBackendCompletenessEstablished).toBe(false);
    expect(result.rows).toEqual([]);
  });
});
