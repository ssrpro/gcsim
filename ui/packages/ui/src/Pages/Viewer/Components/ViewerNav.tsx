import {
  Button,
  ButtonGroup,
  Intent,
  Tab,
  Tabs,
  Toaster,
  Icon,
  Dialog,
  Classes,
  Position,
  Callout,
  Checkbox,
  InputGroup,
  Label,
} from "@blueprintjs/core";
import axios from "axios";
import classNames from "classnames";
import Pako from "pako";
import { Dispatch, RefObject, SetStateAction, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { useAppDispatch } from "../../../Stores/store";
import { appActions } from "../../../Stores/appSlice";
import { bytesToBase64 } from "@gcsim/utils";
import { SimResults } from "@gcsim/types";

const btnClass = classNames("hidden ml-[7px] sm:flex");

type NavProps = {
  data: SimResults | null;
  tabState: [string, Dispatch<SetStateAction<string>>];
  running: boolean;
};

export default ({ tabState, data, running }: NavProps) => {
  const { t } = useTranslation();
  const [tabId, setTabId] = tabState;
  const copyToast = useRef<Toaster>(null);

  return (
    <Tabs selectedTabId={tabId} onChange={(s) => setTabId(s as string)}>
      <Tab id="results" title={t<string>("viewer.results")} className="focus:outline-none" />
      <Tab id="config" title={t<string>("viewer.config")} className="focus:outline-none" />
      {/* <Tab id="analyze" title={t<string>("viewer.analyze")} className="focus:outline-none" /> */}
      <Tab id="sample" title={t<string>("viewer.sample")} className="focus:outline-none" />
      <Tabs.Expander />
      <ButtonGroup>
        <CopyToClipboard copyToast={copyToast} config={data?.config_file} />
        <SendToSim config={data?.config_file} />
        <Share copyToast={copyToast} data={data} running={running} />
      </ButtonGroup>
      <Toaster ref={copyToast} position={Position.TOP_RIGHT} />
    </Tabs>
  );
};

const CopyToClipboard = ({
  copyToast,
  config,
}: {
  copyToast: RefObject<Toaster>;
  config?: string;
}) => {
  const { t } = useTranslation();

  const action = () => {
    navigator.clipboard.writeText(config ?? "").then(() => {
      copyToast.current?.show({
        message: t<string>("viewer.copied_to_clipboard"),
        intent: Intent.SUCCESS,
        timeout: 2000,
      });
    });
  };

  return (
    <>
      <Button
        icon={<Icon icon="clipboard" className="!mr-0" />}
        onClick={action}
        disabled={config == null}
      >
        <div className={btnClass}>{t<string>("viewer.copy")}</div>
      </Button>
    </>
  );
};

const SendToSim = ({ config }: { config?: string }) => {
  const LOCALSTORAGE_KEY = "gcsim-viewer-cpy-cfg-settings";
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const dispatch = useAppDispatch();

  const [isOpen, setOpen] = useState(false);
  const [keepTeam, setKeep] = useState<boolean>(() => {
    return localStorage.getItem(LOCALSTORAGE_KEY) === "true";
  });

  const toggleKeepTeam = () => {
    localStorage.setItem(LOCALSTORAGE_KEY, String(!keepTeam));
    setKeep(!keepTeam);
  };

  const toSimulator = () => {
    if (config == null) {
      return;
    }
    dispatch(appActions.setCfg({ cfg: config, keepTeam: keepTeam }));
    setLocation("/simulator");
  };

  return (
    <>
      <Button
        className="!hidden sm:!flex"
        icon={<Icon icon="send-to" className="!mr-0" />}
        onClick={() => setOpen(true)}
        disabled={config == null}
      >
        <div className="hidden ml-[7px] sm:flex">{t<string>("viewer.send_to_simulator")}</div>
      </Button>
      <Dialog
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        title={t<string>("viewer.load_this_configuration")}
        icon="bring-data"
      >
        <div className={Classes.DIALOG_BODY}>
          <Callout intent="warning" className="">
            {t<string>("viewer.this_will_overwrite")}
          </Callout>
          <Checkbox
            label="Copy action list only (ignore character stats)"
            className="my-3 mx-1"
            checked={keepTeam}
            onClick={toggleKeepTeam}
          />
        </div>
        <div className={classNames(Classes.DIALOG_FOOTER, Classes.DIALOG_FOOTER_ACTIONS)}>
          <Button onClick={toSimulator} intent={Intent.PRIMARY} text={t<string>("viewer.continue")} />
          <Button onClick={() => setOpen(false)} text={t<string>("viewer.cancel")} />
        </div>
      </Dialog>
    </>
  );
};

type ShareProps = {
  running: boolean;
  copyToast: RefObject<Toaster>;
  data: SimResults | null;
}

const Share = ({ running, copyToast, data }: ShareProps) => {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  const convert = () => {
    const cpy = Object.assign({}, data);
    return {
      data: bytesToBase64(Pako.deflate(JSON.stringify(cpy))),
      meta: {
        char_names: data?.character_details?.map((c) => c.name),
        dps: data?.statistics?.dps,
        sim_duration: data?.statistics?.duration,
        itr: data?.statistics?.iterations,
        char_details: data?.character_details,
        // TODO:
        // - dps_by_target
        // - runtime
        // - num_targets
      },
    };
  };

  const handleShare = () => {
    const out = convert();
    console.log(JSON.stringify(out));
    axios
      .post("/hastebin/post", out)
      .then((resp) => {
        setShareLink(
          window.location.protocol +
            "//" +
            window.location.host +
            "/viewer/share/" +
            "hb-" +
            resp.data.key
        );
      })
      .catch((err) => {
        console.log(err);
      });
  };

  const copy = () => {
    navigator.clipboard.writeText(shareLink ?? "").then(() => {
      copyToast.current?.show({
        message: "Link copied to clipboard!",
        intent: Intent.SUCCESS,
        timeout: 2000,
      });
    });
  };

  return (
    <>
      <Button
        icon={<Icon icon="link" className="!mr-0" />}
        intent={Intent.PRIMARY}
        disabled={running || data == null}
        onClick={() => {
          handleShare();
          setOpen(true);
        }}
      >
        <div className={btnClass}>{t<string>("viewer.share")}</div>
      </Button>
      <Dialog
        isOpen={isOpen}
        onClose={() => setOpen(false)}
        title={t<string>("viewer.create_a_shareable")}
        icon="link"
        className="!pb-0"
      >
        <div className={classNames(Classes.DIALOG_BODY, "flex flex-col justify-center gap-2")}>
          <Label>
            Hastebin (7 day retention)
            <InputGroup
              readOnly={true}
              fill={true}
              onFocus={(e) => {
                e.target.select();
                copy();
              }}
              value={shareLink ?? ""}
              className={classNames({ "bp4-skeleton": shareLink == null })}
              large={true}
              rightElement={<Button icon="duplicate" onClick={() => copy()} />}
            />
          </Label>
        </div>
      </Dialog>
    </>
  );
};