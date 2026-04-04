import React from "react";
import { Redirect } from "expo-router";

export default function AdminRegisterRedirect() {
  return <Redirect href={"/auth/register" as never} />;
}
