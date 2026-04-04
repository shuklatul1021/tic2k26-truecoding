import React from "react";
import { Redirect } from "expo-router";

export default function WorkerLoginRedirect() {
  return <Redirect href={"/auth/login" as never} />;
}
