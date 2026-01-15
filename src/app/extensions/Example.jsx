import React, { useState } from "react";
import {
  Divider,
  Link,
  Button,
  Text,
  Input,
  Flex,
  Heading,
  hubspot,
} from "@hubspot/ui-extensions";
import ApiTestPageV2 from "../../v2/ui/ApiTestPageV2";

// Define the extension to be run within the Hubspot CRM
hubspot.extend(({ context, runServerlessFunction, actions }) => (
  <Extension
    context={context}
    runServerless={runServerlessFunction}
    sendAlert={actions.addAlert}
  />
));

// Define the Extension component, taking in runServerless, context, & sendAlert as props
const Extension = ({ context, runServerless, sendAlert }) => {
  return (
    <>
      <ApiTestPageV2 context={context} runServerless={runServerless} />
    </>
  );
};
