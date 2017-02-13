import {
    IServerConnection
} from '../core/connections'

import {
    IASTManagerModule
} from './astManager'

import {
    IValidationIssue,
    StructureNodeJSON,
    Icons,
    TextStyles,
    StructureCategories
} from '../../common/typeInterfaces'

import rp=require("raml-1-parser")
import lowLevel=rp.ll;
import hl=rp.hl;
import utils = rp.utils;
import ramlOutline =require('raml-outline')
let universes=rp.universes;





export interface IStructureManagerModule {
    listen() : void;
}

export function createManager(connection : IServerConnection,
                              astManagerModule : IASTManagerModule) : IStructureManagerModule {

    return new StructureManager(connection, astManagerModule);
}



/**
 * Generates node key
 * @param node
 * @returns {any}
 */
export function keyProvider(node: hl.IParseResult) : string {
    if (!node) return null;
    if (node && !node.parent()) return node.name();
    else return node.name() + " :: " + keyProvider(node.parent());
}

var prohibit={
    resources:true,
    schemas:true,
    types:true,
    resourceTypes:true,
    traits:true
}

export function isResource(p: hl.IHighLevelNode) {
    return (p.definition().key()===universes.Universe08.Resource||p.definition().key()===universes.Universe10.Resource);
}

export function isOther(p: hl.IHighLevelNode) {
    if (p.property()){
        var nm=p.property().nameId();
        if (prohibit[nm]){
            return false;
        }
    }
    return true;
}
export function isResourceTypeOrTrait(p: hl.IHighLevelNode) {
    var pc=p.definition().key();

    return (pc ===universes.Universe08.ResourceType
    ||pc===universes.Universe10.ResourceType||
    pc === universes.Universe08.Trait
    ||
    pc===universes.Universe10.Trait);
}

export function isSchemaOrType(p: hl.IHighLevelNode) {

    if (p.parent() && p.parent().parent() == null) {
        var property = p.property();

        return property.nameId() == universes.Universe10.LibraryBase.properties.types.name ||
            property.nameId() == universes.Universe10.LibraryBase.properties.schemas.name ||
            property.nameId() == universes.Universe08.Api.properties.schemas.name;
    }

    return false;
}


function createCategories() : void {
    ramlOutline.addCategoryFilter(StructureCategories[StructureCategories.ResourcesCategory], <any>isResource);
    ramlOutline.addCategoryFilter(StructureCategories[StructureCategories.SchemasAndTypesCategory], <any>isSchemaOrType);
    ramlOutline.addCategoryFilter(StructureCategories[StructureCategories.ResourceTypesAndTraitsCategory], <any>isResourceTypeOrTrait);
    ramlOutline.addCategoryFilter(StructureCategories[StructureCategories.OtherCategory], <any>isOther);
}

function createDecorations() : void {
    ramlOutline.addDecoration(ramlOutline.NodeType.ATTRIBUTE, {
        icon: Icons[Icons.ARROW_SMALL_LEFT],
        textStyle: TextStyles[TextStyles.NORMAL]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.RESOURCE, {
        icon: Icons[Icons.PRIMITIVE_SQUARE],
        textStyle: TextStyles[TextStyles.HIGHLIGHT]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.METHOD, {
        icon: Icons[Icons.PRIMITIVE_DOT],
        textStyle: TextStyles[TextStyles.WARNING]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.SECURITY_SCHEME, {
        icon: Icons[Icons.FILE_SUBMODULE],
        textStyle: TextStyles[TextStyles.NORMAL]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.ANNOTATION_DECLARATION, {
        icon: Icons[Icons.TAG],
        textStyle: TextStyles[TextStyles.HIGHLIGHT]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.TYPE_DECLARATION, {
        icon: Icons[Icons.FILE_BINARY],
        textStyle: TextStyles[TextStyles.SUCCESS]
    });

    ramlOutline.addDecoration(ramlOutline.NodeType.DOCUMENTATION_ITEM, {
        icon: Icons[Icons.BOOK],
        textStyle: TextStyles[TextStyles.NORMAL]
    });
}

export function initialize() {

    ramlOutline.initialize();
    ramlOutline.setKeyProvider(<any>keyProvider);

    createCategories();

    createDecorations();
}

initialize();

class ASTProvider implements ramlOutline.IASTProvider {
    constructor(private uri: string, private astManagerModule: IASTManagerModule) {
    }

    getASTRoot() {
        return <any> this.astManagerModule.getCurrentAST(this.uri);
    }

    getSelectedNode() {
        return this.getASTRoot();
    }
}

class StructureManager {
    constructor(private connection: IServerConnection, private astManagerModule: IASTManagerModule) {
    }

    listen() {
        this.connection.onDocumentStructure(uri=>{
            return this.getStructure(uri);
        })
    }

    vsCodeUriToParserUri(vsCodeUri : string) : string {
        if (vsCodeUri.indexOf("file://") == 0) {
            return vsCodeUri.substring(7);
        }

        return vsCodeUri;
    }

    getStructure(uri : string): {[categoryName:string] : StructureNodeJSON} {

        this.connection.debug("Called for uri: " + uri,
            "StructureManager", "getStructure");

        ramlOutline.setASTProvider(new ASTProvider(uri, this.astManagerModule));

        return ramlOutline.getStructureForAllCategories();
    }
}