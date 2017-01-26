
// produce nodeset xml files
import XMLWriter from "xml-writer";
import { 
  isNullOrUndefined,
  capitalizeFirstLetter } from "lib/misc/utils";
import UAVariable from "./UAVariable";
import BaseNode from "lib/address_space/BaseNode";
import UADataType from "lib/address_space/UADataType";
import UAObject from "lib/address_space/UAObject";
import UAObjectType from "lib/address_space/UAObjectType";
import UAMethod  from "lib/address_space/UAMethod";
import { VariantArrayType } from "lib/datamodel/variant";
import { NodeId } from "lib/datamodel/nodeid";
import { Variant } from "lib/datamodel/variant";
import { DataType } from "schemas/DataType_enum";
import assert from "better-assert";
import _ from "underscore";

function _dumpDisplayName(xw, node) {
  xw.startElement("DisplayName").text(node.displayName[0].text).endElement();
}
function _dumpDescription(xw, node) {
  if (node.description) {
    let desc = node.description.text;
    desc = desc || "";
    xw.startElement("Description").text(desc).endElement();
  }
}

function _dumpReferences(xw, node) {
  xw.startElement("References");

  const references = _.map(node._referenceIdx);
  references.forEach((reference) => {
    xw.startElement("Reference");
    xw.writeAttribute("ReferenceType", reference.referenceType);
    if (!reference.isForward) {
      xw.writeAttribute("IsForward", reference.isForward ? "true" : "false");
    }
    xw.text(reference.nodeId.toString());
    xw.endElement();
  });
  xw.endElement();
}


// istanbul ignore next
BaseNode.prototype.dumpXML = function (xmlWriter) {
  console.error(" This ", this.nodeClass);
  assert(false, "BaseNode#dumpXML NOT IMPLEMENTED !");
  assert(xmlWriter);
};


function _dumpVariantExtensionObjectValue_Body(xw, schema, value) {
  xw.startElement(schema.name);
  if (value) {
    schema.fields.forEach((field) => {
      xw.startElement(capitalizeFirstLetter(field.name));
      const v = value[field.name];
      if (v !== null && v !== undefined) {
                // xx console.log("xxxxx field",field," V ".red,v);
        switch (field.fieldType) {
          case "UInt64":
          case "Int64":
            xw.text(v[1].toString());
            break;
          case "LocalizedText":
            xw.startElement("Locale");
            if (v.locale) { xw.text(v.locale); }
            xw.endElement();
            xw.startElement("Text");
            if (v.text) { xw.text(v.text); }
            xw.endElement();
            break;
          default:
            xw.text(v.toString());
        }
      }
      xw.endElement();
    });
  }
  xw.endElement();
}
import { getFactory } from "lib/misc/factories_factories";
/* encode object as XML */
function _dumpVariantExtensionObjectValue(xw, schema, value) {
  xw.startElement("ExtensionObject");
  {
    xw.startElement("TypeId");
    {
            // find HasEncoding node
      const encodingDefaultXml = getFactory(schema.name).prototype.encodingDefaultXml;
            // xx var encodingDefaultXml = schema.encodingDefaultXml;
      xw.startElement("Identifier");
      xw.text(encodingDefaultXml.toString());
      xw.endElement();
    }
    xw.endElement();

    xw.startElement("Body");
    _dumpVariantExtensionObjectValue_Body(xw, schema, value);
    xw.endElement();
  }
  xw.endElement();
}
function _dumpValue(xw, node) {
  const addressSpace = node.addressSpace;

  const value = node._dataValue.value;
  if (!value) {
    return;
  }
    // xx console.log(value);

  assert(value instanceof Variant);


  const dataTypeName = addressSpace.findNode(node.dataType).browseName.toString(); // value.dataType.toString();

  const baseDataTypeName = DataType.get(value.dataType).key;

  const f = getFactory(dataTypeName);
  if (!f) {
    console.log("nodeset_to_xml #_dumpValue Cannot find ", dataTypeName);
    return;
  }
  const schema = f.prototype._schema;

    // xx console.log("xxxxxxxxx schema".cyan,dataTypeName.yellow,schema);
  function encodeXml(value) {
    _dumpVariantExtensionObjectValue_Body(xw, schema, value);
  }

  xw.startElement("Value");


    // determine if dataTypeName is a ExtensionObject
  const isExtensionObject = dataTypeName !== "LocalizedText";

  if (isExtensionObject) {
    if (value.arrayType === VariantArrayType.Array) {
      xw.startElement(`ListOf${baseDataTypeName}`);
      value.value.forEach(_dumpVariantExtensionObjectValue.bind(null, xw, schema));
      xw.endElement();
    } else if (value.arrayType === VariantArrayType.Scalar) {
      _dumpVariantExtensionObjectValue(xw, schema, value);
    }
  } else if (value.arrayType === VariantArrayType.Array) {
    xw.startElement(`ListOf${baseDataTypeName}`);
    xw.writeAttribute("xmlns","http://opcfoundation.org/UA/2008/02/Types.xsd");

    value.value.forEach(encodeXml);

    xw.endElement();
  } else if (value.arrayType === VariantArrayType.Scalar) {
    encodeXml(value.value);
  }

  xw.endElement();
}

function dumpUAVariable(xw, node) {
  const addressSpace = node.addressSpace;
  xw.startElement("UAVariable");
  xw.writeAttribute("NodeId", node.nodeId.toString());
  xw.writeAttribute("BrowseName", node.browseName.toString());
  xw.writeAttribute("SymbolicName", node.symbolicName);
  if (node.valueRank !== -1) {
    xw.writeAttribute("ValueRank", node.valueRank);
  }
  const dataTypeNode = addressSpace.findNode(node.dataType);
  if (!dataTypeNode) {
    throw new Error(` cannot find datatype ${node.dataType}`);
  }
  const dataTypeName = dataTypeNode.browseName.toString();
  xw.writeAttribute("DataType", dataTypeName);

  _dumpDisplayName(xw, node);
  _dumpDescription(xw, node);

  _dumpReferences(xw, node);

  _dumpValue(xw, node);
  xw.endElement();
}

UAVariable.prototype.dumpXML = function (xw) {
  dumpUAVariable(xw, this);
};


function _dumpUADataTypeDefinition(xw, node) {
  const indexes =  node._getDefinition();
  if (indexes) {
    xw.startElement("Definition");
    xw.writeAttribute("Name", node.definitionName);

    _.forEach(indexes.nameIndex,(defItem, key) => {
      xw.startElement("Field");
      console.log(defItem);
      xw.writeAttribute("Name", defItem.name);

      if (defItem.dataType && !defItem.dataType.isEmpty()) {
                // there is no dataType on enumeration
        const dataTypeStr = defItem.dataType.toString();
        xw.writeAttribute("DataType", dataTypeStr);
      }

      if (!isNullOrUndefined(defItem.valueRank)) {
        xw.writeAttribute("ValueRank", defItem.valueRank);
      }
      if (!isNullOrUndefined(defItem.value)) {
        xw.writeAttribute("Value", defItem.value);
      }
      if (defItem.description) {
        xw.startElement("Description");
        xw.text(defItem.description);
        xw.endElement();
      }
      xw.endElement();
    });
    xw.endElement();
  }
}

function dumpUADataType(xw, node) {
  xw.startElement("UADataType");
  xw.writeAttribute("NodeId", node.nodeId.toString());
  xw.writeAttribute("BrowseName", node.browseName.toString());

  if (node.isAbstract) {
    xw.writeAttribute("IsAbstract", node.isAbstract ? "true" : "false");
  }
  _dumpReferences(xw, node);

  _dumpUADataTypeDefinition(xw, node);

  xw.endElement();
}

UADataType.prototype.dumpXML = function (xw) {
  dumpUADataType(xw, this);
};

function dumpCommonAttributes(xw, node) {
  xw.writeAttribute("NodeId", node.nodeId.toString());
  xw.writeAttribute("BrowseName", node.browseName.toString());
  _dumpDisplayName(xw, node);
  _dumpDescription(xw, node);
  _dumpReferences(xw, node);
}
function dumpUAObject(xw, node) {
  xw.startElement("UAObject");
  xw.writeAttribute("SymbolicName", node.symbolicName);
  dumpCommonAttributes(xw, node);
  xw.endElement();
}
UAObject.prototype.dumpXML = function (xw) {
  dumpUAObject(xw, this);
};

function dumpUAObjectType(xw, node) {
  xw.startElement("UAObjectType");
  xw.writeAttribute("IsAbstract", node.isAbstract ? "true" : "false");
  dumpCommonAttributes(xw, node);
  xw.endElement();
}

UAObjectType.prototype.dumpXML = function (xw) {
  dumpUAObjectType(xw, this);
};

function dumpUAMethod(xw, node) {
  xw.startElement("UAMethod");
  xw.writeAttribute("IsAbstract", node.isAbstract ? "true" : "false");
  dumpCommonAttributes(xw, node);
  xw.endElement();
}
UAMethod.prototype.dumpXML = function (xw) {
  dumpUAMethod(xw, this);
};


function visitUANode(node, options) {
    // xx console.log("xxxxx visiting ", node.nodeId.toString(),node.browseName);
  const addressSpace = node.addressSpace;
  options.elements = options.elements || [];
  options.index_el = options.index_el || {};
    // visit references
  function process_reference(reference) {
        // reference.referenceType
    if (!reference.isForward) {
      return;
    }
        // xx console.log("xxxxx reference=".cyan,reference);
    if (reference.nodeId.namespace === 0) {
      return;// skip OPCUA namespace
    }
    const k = reference.nodeId.toString();
    if (!options.index_el[k]) {
      options.index_el[k] = 1;

      const o = addressSpace.findNode(k);
      if (o) {
        visitUANode(o, options);
      }
    }
  }

  _.forEach(node._referenceIdx,process_reference);
  _.forEach(node._back_referenceIdx,process_reference);
  options.elements.push(node);
  return node;
}


function dumpXml(node, options) {
  const addressSpace = node.addressSpace;

    // make a first visit so that we determine which node to output and in which order
  const s = {};

  function resolveDataTypeName(dataType) {
        // istanbul ignore next
    if (_.isString(dataType)) {
      return addressSpace.findDataType(dataType);
    }
    assert(dataType instanceof NodeId);
    const o = addressSpace.findNode(dataType.toString());
    return o ? o.browseName.toString() : null;
  }

  function buildUpAliases(node, options) {
    options.aliases = options.aliases || {};
    options.aliases_visited = options.aliases_visited || {};

    const k = node.nodeId.toString();

        // istanbul ignore next
    if (options.aliases_visited[k]) {
      return;
    }
    options.aliases_visited[k] = 1;

        // put datatype into aliases list
    if (node.dataType && node.dataType.namespace === 0) {
            // name
      const dataTypeName = resolveDataTypeName(node.dataType);
      if (dataTypeName) {
        if (!options.aliases[dataTypeName]) {
          options.aliases[dataTypeName] = node.dataType;
        }
      }
    }


    function add_in_aliases_map(key) {
      if (!options.aliases.key) {
        const nodeId = addressSpace.resolveNodeId(key);
        if (nodeId.namespace === 0) {
          options.aliases[key] = addressSpace.resolveNodeId(key);
        }
      }
    }

    function inner(reference) {
            // reference.referenceType
      const key = reference.referenceType;
      add_in_aliases_map(key);

      const o = addressSpace.findNode(reference.nodeId);
      if (o) {
        buildUpAliases(o, options);
      }
    }

    _.forEach(node._references,inner);
    _.forEach(node._back_referenceIdx,inner);
  }

  function writeAliases(xw, aliases) {
    xw.startElement("Aliases");

    Object.keys(aliases).forEach((key) => {
      xw.startElement("Alias");
      xw.writeAttribute("Alias", key);
      xw.text(`i=${aliases[key].value.toString()}`);
      xw.endElement();
    });

    xw.endElement();
  }

  buildUpAliases(node, s);

  const el = visitUANode(node, s);

    // xx console.log("xxxxx ",s.elements.map(function(e){ return e.nodeId.toString();}).join(" "));
    // xx s.elements.map(function(a){ console.log(a.nodeId.toString(), a.browseName); });


  const xw = new XMLWriter(true);
  xw.startDocument({ encoding: "utf-8" });
  xw.startElement("UANodeSet");
  xw.writeAttribute("xmlns:xs", "http://www.w3.org/2001/XMLSchema-instance");
  xw.writeAttribute("xmlns:xsd", "http://www.w3.org/2001/XMLSchema");
  xw.writeAttribute("Version", "1.02");
  xw.writeAttribute("LastModified", (new Date()).toISOString());
  xw.writeAttribute("xmlns", "http://opcfoundation.org/UA/2011/03/UANodeSet.xsd");

  writeAliases(xw, s.aliases);

  s.elements.forEach((el) => {
        // xx console.log(el.nodeClass);
    el.dumpXML(xw);
  });

  xw.endElement();
  xw.endDocument();
  return xw.toString();
}


export default dumpXml;